#!/usr/bin/env node
// PanAI 视频生成 MCP — 首选本地 ComfyUI/LTX-2.3,失败兜底 Agnes。零依赖 stdio JSON-RPC (MCP)。
// env:
//   VIDEO_PRIMARY   = comfyui (默认)
//   COMFY_BASE      = http://127.0.0.1:8188
//   COMFY_TOKEN_FILE= /home/insome/ComfyUI/login/PASSWORD  (取第一行做 ?token=)
//   COMFY_CKPT      = ltx-2.3-22b-dev-nvfp4.safetensors
//   COMFY_TENC      = gemma_3_12B_it_fp4_mixed.safetensors
//   兜底 Agnes: AGNES_API_KEY / AGNES_BASE_URL / AGNES_VIDEO_MODEL

import { readFileSync } from 'node:fs';

const COMFY_BASE = (process.env.COMFY_BASE || 'http://127.0.0.1:8188').replace(/\/$/, '');
const COMFY_TOKEN_FILE = process.env.COMFY_TOKEN_FILE || '/home/insome/ComfyUI/login/PASSWORD';
const COMFY_CKPT = process.env.COMFY_CKPT || 'ltx-2.3-22b-dev-nvfp4.safetensors';
const COMFY_TENC = process.env.COMFY_TENC || 'gemma_3_12B_it_fp4_mixed.safetensors';
const AGNES_KEY = process.env.AGNES_API_KEY || '';
const AGNES_BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
const AGNES_MODEL = process.env.AGNES_VIDEO_MODEL || 'agnes-video-v2.0';

const SERVER_INFO = { name: 'panai-video-generation', version: '3.0.0' };
const TOOL = {
  name: 'generate_video',
  description: '文生视频。首选本地 ComfyUI/LTX-2.3(GPU,无需联网),失败自动兜底 Agnes 云端。返回生成的视频文件路径/URL。用户想生成/制作一段视频时调用。',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '视频内容描述(英文效果最好)' },
      negative: { type: 'string', description: '不希望出现的内容(可选)' },
      width: { type: 'integer', description: '宽(默认768)' },
      height: { type: 'integer', description: '高(默认512)' },
      length: { type: 'integer', description: '帧数(默认73,约3秒@25fps)' },
      steps: { type: 'integer', description: '采样步数(默认20)' },
      seed: { type: 'integer', description: '随机种子(可选)' },
    },
    required: ['prompt'],
  },
};

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const replyErr = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = () => { try { return readFileSync(COMFY_TOKEN_FILE, 'utf8').split('\n')[0].trim(); } catch { return ''; } };

function buildGraph({ prompt, negative, width, height, length, steps, seed }) {
  const W = width || 768, H = height || 512, L = length || 73, ST = steps || 20, FPS = 25;
  const SEED = (seed != null) ? seed : Math.floor((Date.now() % 2147483647));
  const neg = negative || 'blurry, low quality, distorted, static, watermark';
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: COMFY_CKPT } },
    '2': { class_type: 'LTXAVTextEncoderLoader', inputs: { text_encoder: COMFY_TENC, ckpt_name: COMFY_CKPT, device: 'default' } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: neg, clip: ['2', 0] } },
    '5': { class_type: 'EmptyLTXVLatentVideo', inputs: { width: W, height: H, length: L, batch_size: 1 } },
    '6': { class_type: 'ModelSamplingLTXV', inputs: { model: ['1', 0], max_shift: 2.05, base_shift: 0.95, latent: ['5', 0] } },
    '7': { class_type: 'LTXVConditioning', inputs: { positive: ['3', 0], negative: ['4', 0], frame_rate: FPS } },
    '8': { class_type: 'LTXVScheduler', inputs: { steps: ST, max_shift: 2.05, base_shift: 0.95, stretch: true, terminal: 0.1, latent: ['5', 0] } },
    '9': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    '10': { class_type: 'RandomNoise', inputs: { noise_seed: SEED } },
    '11': { class_type: 'CFGGuider', inputs: { model: ['6', 0], positive: ['7', 0], negative: ['7', 1], cfg: 3.0 } },
    '12': { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['10', 0], guider: ['11', 0], sampler: ['9', 0], sigmas: ['8', 0], latent_image: ['5', 0] } },
    '13': { class_type: 'VAEDecode', inputs: { samples: ['12', 0], vae: ['1', 2] } },
    '14': { class_type: 'CreateVideo', inputs: { images: ['13', 0], fps: FPS } },
    '15': { class_type: 'SaveVideo', inputs: { video: ['14', 0], filename_prefix: 'video/panai_t2v', format: 'auto', codec: 'auto' } },
  };
}

async function comfyGenerate(args) {
  const tk = token();
  if (!tk) throw new Error('ComfyUI token 读取失败');
  const q = `?token=${tk}`;
  const sub = await fetch(`${COMFY_BASE}/prompt${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildGraph(args) }),
  });
  const sj = await sub.json().catch(() => ({}));
  if (!sub.ok || !sj.prompt_id) throw new Error(`ComfyUI 提交失败: ${JSON.stringify(sj).slice(0, 300)}`);
  const pid = sj.prompt_id;
  const t0 = Date.now();
  while (Date.now() - t0 < 20 * 60 * 1000) {
    await sleep(10000);
    const h = await (await fetch(`${COMFY_BASE}/history/${pid}${q}`)).json().catch(() => ({}));
    const rec = h[pid];
    if (rec) {
      const st = rec.status || {};
      if (st.status_str === 'error') throw new Error(`ComfyUI 生成错误: ${JSON.stringify(st.messages || st).slice(0, 400)}`);
      if (st.completed || st.status_str === 'success') {
        // SaveVideo 把视频放在 images 键下;也兼容 videos/gifs
        for (const o of Object.values(rec.outputs || {})) {
          const cands = [...(o.videos || []), ...(o.gifs || []), ...(o.images || [])];
          for (const v of cands) {
            if (!/\.(mp4|webm|mov|gif)$/i.test(v.filename || '')) continue;
            const url = `${COMFY_BASE}/view?filename=${encodeURIComponent(v.filename)}&subfolder=${encodeURIComponent(v.subfolder || '')}&type=${v.type || 'output'}&token=${tk}`;
            const path = `/home/insome/ComfyUI/output/${v.subfolder ? v.subfolder + '/' : ''}${v.filename}`;
            return { url, path };
          }
        }
        throw new Error('ComfyUI 完成但无视频输出');
      }
    }
  }
  throw new Error('ComfyUI 生成超时(20分钟)');
}

async function agnesGenerate({ prompt }) {
  if (!AGNES_KEY) throw new Error('Agnes 未配置');
  const H = { Authorization: `Bearer ${AGNES_KEY}`, 'Content-Type': 'application/json' };
  const sub = await (await fetch(`${AGNES_BASE}/video/generations`, { method: 'POST', headers: H, body: JSON.stringify({ model: AGNES_MODEL, prompt }) })).json();
  const tid = sub.task_id || sub.id;
  if (!tid) throw new Error(`Agnes 提交失败: ${JSON.stringify(sub).slice(0, 200)}`);
  const t0 = Date.now();
  const re = /https?:\/\/[^\s"']+\.(?:mp4|mov|webm)/i;
  while (Date.now() - t0 < 20 * 60 * 1000) {
    await sleep(12000);
    const txt = await (await fetch(`${AGNES_BASE}/video/generations/${tid}`, { headers: H })).text();
    const m = txt.match(re);
    if (m) return { url: m[0] };
    if (/FAIL|ERROR/i.test(txt)) throw new Error('Agnes 生成失败');
  }
  throw new Error('Agnes 超时');
}

async function generateVideo(args) {
  if (!args.prompt) throw new Error('prompt 必填');
  try {
    const r = await comfyGenerate(args);
    return { backend: 'ComfyUI/LTX-2.3(本地)', ...r };
  } catch (e1) {
    try {
      const r = await agnesGenerate(args);
      return { backend: 'Agnes(兜底)', note: `本地失败: ${e1.message}`, ...r };
    } catch (e2) {
      throw new Error(`两个后端都失败 — 本地LTX: ${e1.message} | Agnes兜底: ${e2.message}`);
    }
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { buf += c; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (l) handle(l); } });

async function handle(line) {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') reply(id, { protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    else if (method === 'notifications/initialized') { /* no reply */ }
    else if (method === 'tools/list') reply(id, { tools: [TOOL] });
    else if (method === 'tools/call') {
      if (params?.name !== 'generate_video') return replyErr(id, -32601, `unknown tool: ${params?.name}`);
      const res = await generateVideo(params?.arguments || {});
      const txt = `视频已生成(${res.backend}):\n${res.path || res.url}\n预览URL: ${res.url}${res.note ? '\n注:' + res.note : ''}`;
      reply(id, { content: [{ type: 'text', text: txt }] });
    } else if (method === 'ping') reply(id, {});
    else if (id != null) replyErr(id, -32601, `method not found: ${method}`);
  } catch (e) {
    if (id != null) reply(id, { content: [{ type: 'text', text: `视频生成出错: ${e.message}` }], isError: true });
  }
}

#!/usr/bin/env node
// PanAI 音频生成 MCP — 本地 piper 神经 TTS(离线/GPU无关),失败兜底 Agnes。零依赖 stdio JSON-RPC。
// env:
//   PIPER_PYTHON     = worker venv python (含 piper 模块)
//   PIPER_VOICE_ZH   = 中文语音 onnx
//   PIPER_VOICE_EN   = 英文语音 onnx(可选)
//   PIPER_OUT_DIR    = 输出目录(默认 ~/PanAI-audio)
//   兜底 Agnes: AGNES_API_KEY / AGNES_BASE_URL / AGNES_TTS_MODEL
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const PY = process.env.PIPER_PYTHON || '/home/insome/dev/insomeos/06-workers/.venv/bin/python';
const VOICE_ZH = process.env.PIPER_VOICE_ZH || `${homedir()}/.local/share/piper-voices/zh_CN-huayan-medium.onnx`;
const VOICE_EN = process.env.PIPER_VOICE_EN || '';
const OUT_DIR = process.env.PIPER_OUT_DIR || `${homedir()}/PanAI-audio`;
const AGNES_KEY = process.env.AGNES_API_KEY || '';
const AGNES_BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
const AGNES_TTS = process.env.AGNES_TTS_MODEL || 'agnes-tts-v1';

const SERVER_INFO = { name: 'panai-audio-generation', version: '1.0.0' };
const TOOL = {
  name: 'generate_speech',
  description: '文字转语音(TTS)。首选本地 piper 神经语音(离线、免费、支持中/英),失败兜底 Agnes 云端。返回生成的 wav 文件路径。用户想把文字合成语音/配音/朗读时调用。',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要合成的文字' },
      lang: { type: 'string', description: '语言: zh(默认) 或 en' },
      output: { type: 'string', description: '输出 wav 路径(可选,默认自动命名)' },
    },
    required: ['text'],
  },
};

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const replyErr = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

function piperTTS({ text, lang, output }) {
  return new Promise((resolve, reject) => {
    const voice = (lang === 'en' && VOICE_EN) ? VOICE_EN : VOICE_ZH;
    if (!existsSync(voice)) return reject(new Error(`语音模型不存在: ${voice}`));
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    const out = output || `${OUT_DIR}/tts_${Date.now()}.wav`;
    const p = spawn(PY, ['-m', 'piper', '-m', voice, '-f', out], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0 && existsSync(out)) resolve({ path: out });
      else reject(new Error(`piper 失败(code ${code}): ${err.slice(-300)}`));
    });
    p.stdin.write(text); p.stdin.end();
  });
}

async function agnesTTS({ text }) {
  if (!AGNES_KEY) throw new Error('Agnes 未配置');
  const H = { Authorization: `Bearer ${AGNES_KEY}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${AGNES_BASE}/audio/speech`, { method: 'POST', headers: H, body: JSON.stringify({ model: AGNES_TTS, input: text, voice: 'alloy' }) });
  if (!r.ok) throw new Error(`Agnes TTS ${r.status}: ${(await r.text()).slice(0, 200)}`);
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const out = `${OUT_DIR}/tts_agnes_${Date.now()}.wav`;
  const buf = Buffer.from(await r.arrayBuffer());
  (await import('node:fs')).writeFileSync(out, buf);
  return { path: out };
}

async function generateSpeech(args) {
  if (!args.text) throw new Error('text 必填');
  try {
    const r = await piperTTS(args);
    return { backend: 'piper(本地神经TTS)', ...r };
  } catch (e1) {
    try { const r = await agnesTTS(args); return { backend: 'Agnes(兜底)', note: `本地失败: ${e1.message}`, ...r }; }
    catch (e2) { throw new Error(`两后端均失败 — piper: ${e1.message} | Agnes: ${e2.message}`); }
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
      if (params?.name !== 'generate_speech') return replyErr(id, -32601, `unknown tool: ${params?.name}`);
      const res = await generateSpeech(params?.arguments || {});
      reply(id, { content: [{ type: 'text', text: `语音已生成(${res.backend}):\n${res.path}${res.note ? '\n注:' + res.note : ''}` }] });
    } else if (method === 'ping') reply(id, {});
    else if (id != null) replyErr(id, -32601, `method not found: ${method}`);
  } catch (e) {
    if (id != null) reply(id, { content: [{ type: 'text', text: `语音生成出错: ${e.message}` }], isError: true });
  }
}

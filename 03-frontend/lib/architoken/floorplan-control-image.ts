// lib/architoken/floorplan-control-image.ts - 户型布局 -> ControlNet 线稿 PNG（灰度，确定性）
// License: Apache-2.0

import { deflateSync } from "node:zlib";

import {
  rectFromBlock,
  type GeneratedPlan,
} from "./floorplan-layout";

const MAX_EDGE_PX = 1024;
const MIN_EDGE_PX = 256;
const MARGIN_PX = 24;
const WALL_PX = 5;

export interface FloorplanLineartOptions {
  floor?: 1 | 2;
}

/**
 * 把户型布局光栅化为黑墙白底的线稿 PNG，作为 ControlNet/图生图的控制图。
 * 输出为 8-bit 灰度 PNG，同一布局输入产生字节级一致的结果。
 */
export function rasterizeFloorplanLineartPng(
  plan: GeneratedPlan,
  options: FloorplanLineartOptions = {},
): Buffer {
  const floor = options.floor ?? 1;
  const blocks = plan.blocks.filter((block) => block.floor === floor);
  if (blocks.length === 0) {
    throw new Error(`floorplan has no blocks on floor ${floor}`);
  }
  const [envW, envH] = plan.summary.envelope;
  const scale = Math.min(
    (MAX_EDGE_PX - MARGIN_PX * 2) / Math.max(envW, envH),
    1,
  );
  const width = Math.max(MIN_EDGE_PX, Math.round(envW * scale) + MARGIN_PX * 2);
  const height = Math.max(
    MIN_EDGE_PX,
    Math.round(envH * scale) + MARGIN_PX * 2,
  );
  const pixels = new Uint8Array(width * height).fill(255);

  for (const block of blocks) {
    const rect = rectFromBlock(block);
    const x0 = MARGIN_PX + Math.round(rect.x0 * scale);
    const y0 = MARGIN_PX + Math.round(rect.y0 * scale);
    const x1 = MARGIN_PX + Math.round(rect.x1 * scale);
    const y1 = MARGIN_PX + Math.round(rect.y1 * scale);
    strokeRect(pixels, width, height, x0, y0, x1, y1, WALL_PX);
  }

  return encodeGrayscalePng(pixels, width, height);
}

/** 风格预设：指令命中关键词即展开成完整风格描述，未命中用现代简约缺省。 */
const RENDER_STYLE_PRESETS: Array<[RegExp, string]> = [
  [
    /新中式|中式/,
    "新中式风格：胡桃木色家具、水墨屏风、宣纸色墙面、黄铜点缀、对称布局",
  ],
  [
    /北欧/,
    "北欧风格：浅橡木地板、白墙、灰色布艺沙发、绿植点缀、自然光通透",
  ],
  [
    /工业风|工业/,
    "工业风格：水泥灰地面、裸露砖墙、黑色金属框架、皮质家具、暖色射灯",
  ],
  [
    /奶油风|奶油/,
    "奶油风格：奶白色墙面、米色布艺、原木色点缀、圆角家具、柔和漫射光",
  ],
  [
    /轻奢/,
    "轻奢风格：大理石地面、丝绒家具、金属线条、深色木饰面、层次照明",
  ],
  [
    /日式|侘寂/,
    "日式侘寂风格：榻榻米与原木、米色硅藻泥墙面、低矮家具、留白构图",
  ],
  [
    /现代简约|简约|现代/,
    "现代简约风格：木地板、白墙、极简家具、中性色调、大面积留白",
  ],
];
const DEFAULT_RENDER_STYLE =
  "现代简约风格：木地板、白墙、极简家具、中性色调、自然采光";

export function resolveRenderStyle(userInput: string): string {
  return (
    RENDER_STYLE_PRESETS.find(([pattern]) => pattern.test(userInput))?.[1] ??
    DEFAULT_RENDER_STYLE
  );
}

export function buildFloorplanRenderPrompt(
  plan: GeneratedPlan,
  userInput: string,
): string {
  const rooms = [...new Set(plan.blocks.map((block) => block.purpose))].join(
    "、",
  );
  return [
    `按给定户型平面线稿生成室内俯视效果图，严格保持墙体布局、房间位置与比例不变。`,
    `户型：${plan.intentLabel}，房间包含 ${rooms}。`,
    `风格：${resolveRenderStyle(userInput)}`,
    `用户原始需求：${userInput}`,
    `要求：写实材质与光照、家具与房间用途匹配、不得增删或移动墙体。`,
  ].join("\n");
}

function strokeRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
): void {
  fillRect(pixels, width, height, x0, y0, x1, y0 + thickness);
  fillRect(pixels, width, height, x0, y1 - thickness, x1, y1);
  fillRect(pixels, width, height, x0, y0, x0 + thickness, y1);
  fillRect(pixels, width, height, x1 - thickness, y0, x1, y1);
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const left = Math.max(0, Math.min(x0, x1));
  const right = Math.min(width, Math.max(x0, x1));
  const top = Math.max(0, Math.min(y0, y1));
  const bottom = Math.min(height, Math.max(y0, y1));
  for (let y = top; y < bottom; y += 1) {
    pixels.fill(0, y * width + left, y * width + right);
  }
}

function encodeGrayscalePng(
  pixels: Uint8Array,
  width: number,
  height: number,
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(0, 9); // color type: grayscale
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0; // filter type 0 per scanline
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

let crcTable: Uint32Array | null = null;

function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let k = 0; k < 8; k += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[n] = value >>> 0;
    }
  }
  const table = crcTable;
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (table[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

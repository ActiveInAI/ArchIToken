// lib/local-models-action.ts
// License: Apache-2.0
'use server';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 过滤终端输出的 ANSI 颜色和样式代码
function stripAnsi(str: string) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export async function getOllamaModels(): Promise<string[]> {
  const models: Set<string> = new Set();
  try {
    const { stdout } = await execAsync('ollama ls');
    const lines = stripAnsi(stdout).split('\n').slice(1);
    for (const line of lines) {
      if (!line.trim() || line.includes('NAME')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts[0]) models.add(parts[0]);
    }
  } catch (e) {
    console.error('Ollama fetch error:', e);
  }
  return Array.from(models).sort();
}

export async function getHfModels(): Promise<string[]> {
  const models: Set<string> = new Set();
  try {
    const { stdout } = await execAsync('hf cache ls');
    const lines = stripAnsi(stdout).split('\n').slice(2);
    for (const line of lines) {
      if (!line.trim() || line.startsWith('Found') || line.startsWith('---')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts[0]) {
        const id = parts[0].replace(/^model\//, '');
        models.add(id);
      }
    }
  } catch (e) {
    console.error('HF fetch error:', e);
  }
  return Array.from(models).sort();
}

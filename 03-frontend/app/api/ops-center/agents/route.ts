// app/api/ops-center/agents/route.ts
// License: Apache-2.0
// 智能体观测：发现本机的 agent 项目目录、关联的运行容器与最近活跃度。
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const HOME = os.homedir();

interface AgentDef {
  name: string;
  dir: string;
  keywords: string[];
}

const AGENT_PROJECTS: AgentDef[] = [
  { name: "Hermes Agent", dir: ".hermes", keywords: ["hermes"] },
  { name: "ArchiToken", dir: ".architoken", keywords: ["architoken"] },
  { name: "insomeos", dir: "dev/insomeos", keywords: ["insomeos"] },
  { name: "PanClaw", dir: "dev/PanClaw", keywords: ["panclaw", "panai", "panaec"] },
  { name: "pan-aec", dir: "pan-aec", keywords: ["pan-aec", "panaec", "pan_aec"] },
  { name: "CADAM", dir: "CADAM", keywords: ["cadam"] },
  { name: "insome-ai", dir: "Desktop/insome-ai", keywords: ["insome-ai", "opencut", "draw-io"] },
  { name: "Agents", dir: ".agents", keywords: ["agent"] },
];

export async function GET() {
  let runningContainers: string[] = [];
  try {
    const { stdout } = await execFileAsync("docker", ["ps", "--format", "{{.Names}}"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    runningContainers = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    // 容器列举失败不致命，仅影响关联信息
    void error;
  }

  const agents = await Promise.all(
    AGENT_PROJECTS.map(async (project) => {
      const absolute = path.join(HOME, project.dir);
      let exists = false;
      let mtime = 0;
      try {
        const stat = await fs.stat(absolute);
        exists = stat.isDirectory();
        mtime = stat.mtimeMs;
      } catch {
        exists = false;
      }
      const containers = runningContainers.filter((name) => {
        const lower = name.toLowerCase();
        return project.keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
      });
      return {
        name: project.name,
        path: project.dir,
        exists,
        mtime,
        containers,
        running: containers.length > 0,
      };
    }),
  );

  return Response.json(
    { generatedAt: new Date().toISOString(), agents },
    { headers: { "cache-control": "no-store" } },
  );
}

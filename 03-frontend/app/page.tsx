// app/page.tsx — InsomeOS Landing
// React Server Component · Next.js 16.2.4
// License: Apache-2.0

import Link from 'next/link';
import { ChevronRight, Zap, Shield, Layers } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="container mx-auto px-6 pt-24 pb-16 md:pt-32">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/60 px-3 py-1 text-xs font-mono tracking-widest uppercase">
            <span className="h-2 w-2 rounded-full bg-accent" />
            v2.0 · Harness Edition · April 2026
          </div>

          <h1 className="font-serif text-6xl md:text-8xl font-black leading-[0.95] tracking-tight mb-8">
            一副 <em className="italic text-accent">AEC 专用</em>
            <br />
            大模型的 <em className="italic">缰绳</em>
          </h1>

          <p className="text-xl md:text-2xl text-ink/75 leading-relaxed max-w-2xl mb-10 font-serif">
            InsomeOS 不是又一个 AI 工具。它是让通用 LLM 在建筑、工程、施工领域
            <mark className="bg-gold/25 px-1">能干活、干对活、敢让它干活</mark>
            的那套系统工程。
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/app/projects"
              className="inline-flex items-center gap-2 bg-ink text-paper px-6 py-3 font-mono text-sm tracking-wide hover:bg-accent transition-colors"
            >
              开始项目 <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 border-2 border-ink px-6 py-3 font-mono text-sm tracking-wide hover:bg-ink hover:text-paper transition-colors"
            >
              阅读架构
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-ink/10 bg-paper/60">
        <div className="container mx-auto px-6 py-16 grid md:grid-cols-3 gap-10">
          <Feature
            icon={<Layers className="h-6 w-6" />}
            title="8 层分离架构"
            body="从硬件到前端,每一层单一职责、单向依赖。Cursor 实验证实:清晰边界让 Agent 更快收敛。"
          />
          <Feature
            icon={<Zap className="h-6 w-6" />}
            title="6 路推理引擎"
            body="vLLM · SGLang · TensorRT-LLM · LMDeploy · Ollama · llama.cpp 全部 OpenAI 兼容,毫秒级热插拔。"
          />
          <Feature
            icon={<Shield className="h-6 w-6" />}
            title="100% 宽松许可"
            body="Apache-2.0 / MIT / BSD 零传染性。CI 强制拦截 GPL / AGPL / SSPL,永远闭源友好。"
          />
        </div>
      </section>

      <section className="container mx-auto px-6 py-24">
        <h2 className="font-serif text-5xl font-black mb-10">九大业务阶段</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            ['售前', '客户需求 → 报价 + 初版'],
            ['方案', '户型 → 3 个方案 + 造价估'],
            ['深化', '方案 → BIM + 施工图'],
            ['造价', 'BIM → BOQ + 报价 Excel'],
            ['制造', '结构件 → CNC 文件'],
            ['物流', 'BOM → 运输 + 吊装'],
            ['施工', '4D 模拟 + 班组调度'],
            ['验收', '标准 + 照片 → 整改单'],
            ['运维', '数字孪生 + IoT 流'],
          ].map(([name, body]) => (
            <div
              key={name}
              className="border border-ink p-6 hover:bg-accent/5 transition-colors"
            >
              <div className="font-mono text-xs tracking-widest text-accent mb-2">
                {name}
              </div>
              <p className="text-sm text-ink/80 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink bg-ink text-paper/80 py-12 font-mono text-xs tracking-widest">
        <div className="container mx-auto px-6 text-center leading-loose">
          <p className="text-paper font-bold">INSOMEOS v2.0</p>
          <p>ActiveInAI / OPC · 2026-04-19</p>
          <p>
            Pan.AI → PanAEC → AEC-OS → ArchTwin OS → Baja1000 → <b>InsomeOS</b>
          </p>
          <p className="mt-4 not-italic">
            基于《Harness 时代》· 智灵姐 · 2026-04-14 · 中智凯灵
          </p>
        </div>
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center justify-center h-12 w-12 bg-ink text-paper mb-4">
        {icon}
      </div>
      <h3 className="font-serif text-2xl font-bold mb-2">{title}</h3>
      <p className="text-ink/75 leading-relaxed">{body}</p>
    </div>
  );
}

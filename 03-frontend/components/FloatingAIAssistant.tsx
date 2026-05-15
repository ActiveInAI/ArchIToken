// components/FloatingAIAssistant.tsx - Global ArchIToken AI assistant
// License: Apache-2.0
'use client';

import { Bot, CheckCircle2, Copy, Heart, Home, MessageCircle, Send, Sparkles, Star, X } from 'lucide-react';
import { useState } from 'react';
import { createModuleAuditEvent, type ModuleActionResult } from '@/lib/module-actions';
import {
  architokenAssistantProfile,
  moduleAssistantSuggestions,
} from '@/lib/ai-assistant-profile';
import type { ModuleSpec } from '@/lib/module-registry';

export function FloatingAIAssistant({
  module,
  onAudit,
  selectedFeatureTitle,
}: {
  module: ModuleSpec;
  onAudit?: (event: ModuleActionResult['auditEvent']) => void;
  selectedFeatureTitle?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showProfile, setShowProfile] = useState(true);
  const [dock, setDock] = useState<'left' | 'right'>('right');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([
    `我正在读取 ${module.zhName} 上下文,可以帮你生成、校核、审批建议和风险解释。`,
  ]);
  const profile = architokenAssistantProfile;
  const suggestions = moduleAssistantSuggestions[module.id];
  const selectedFeatureMessage = selectedFeatureTitle
    ? `${profile.name}: 已感知到您选中了业务对象：【${selectedFeatureTitle}】。我可以为您提供针对该对象的生成、校核、审批建议和风险解释。`
    : null;
  const visibleMessages = selectedFeatureMessage ? [selectedFeatureMessage, ...messages].slice(0, 5) : messages;

  function pushMessage(summary: string) {
    const message = `${profile.name}: ${summary}`;
    setMessages((current) => [message, ...current].slice(0, 5));
    onAudit?.(createModuleAuditEvent(`assistant-${module.id}`, profile.name, summary));
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`arch-surface fixed bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-lg border backdrop-blur transition md:bottom-5 ${
          dock === 'right' ? 'right-4 md:right-5' : 'left-4 md:left-5'
        }`}
        aria-label="展开 ArchIToken AI 助手"
        title="ArchIToken AI"
      >
        <span className="arch-btn-primary relative flex h-9 w-9 items-center justify-center rounded-md">
          <Bot className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--arch-surface)] bg-[var(--arch-success)]" />
        </span>
      </button>
    );
  }

  return (
    <>
    <section className={`arch-surface fixed inset-x-3 bottom-20 z-50 max-h-[72vh] overflow-hidden rounded-lg border md:inset-x-auto md:bottom-5 md:w-[370px] ${
      dock === 'right' ? 'md:right-5' : 'md:left-5'
    }`}>
      <div className="arch-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => setShowProfile((current) => !current)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="arch-btn-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-md">
            <Bot className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-base font-black">
              {profile.name}
              <CheckCircle2 className="arch-primary-text h-4 w-4" />
            </span>
            <span className="arch-muted mt-0.5 block truncate text-xs">
              {profile.level} · {profile.role}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDock((current) => (current === 'right' ? 'left' : 'right'))}
            className="arch-btn rounded-md px-2 py-2 text-[10px] font-black transition"
          >
            {dock === 'right' ? '停靠左' : '停靠右'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="arch-btn flex h-9 w-9 items-center justify-center rounded-md transition"
            aria-label="收起 ArchIToken AI 助手"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[calc(72vh-74px)] overflow-y-auto p-4">
        {showProfile ? (
          <ProfileCard
            followers={profile.followers}
            onCollect={() => pushMessage(`已收藏 ${module.zhName} 的 AI 主页上下文。`)}
            onCopy={() => pushMessage(`已复制 ${module.zhName} 助手链接。`)}
          />
        ) : null}

        <div className="arch-card-muted mt-4 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.28em]">
                Context
              </p>
              <h3 className="mt-1 text-lg font-black">{module.zhName} 建议</h3>
            </div>
            <Sparkles className="arch-primary-text h-5 w-5" />
          </div>
          <div className="mt-3 space-y-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => pushMessage(item)}
                className="arch-card w-full rounded-md px-3 py-2 text-left text-sm leading-6 transition hover:border-[var(--arch-primary)] hover:bg-[var(--arch-primary-soft)]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {profile.quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => pushMessage(`${action}: 已基于 ${module.zhName} 生成建议。`)}
              className="arch-btn rounded-md px-3 py-2 text-xs font-black transition"
            >
              {action}
            </button>
          ))}
        </div>

        <div className="arch-card-muted mt-4 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="arch-primary-text h-4 w-4" />
            <h3 className="font-black">消息区</h3>
          </div>
          <div className="mt-3 space-y-2">
            {visibleMessages.map((message, index) => (
              <p key={`${index}-${message}`} className="arch-card rounded-md px-3 py-2 text-sm leading-6">
                {message}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              pushMessage(`已打开 ${module.zhName} 对话抽屉。`);
            }}
            className="arch-btn-primary mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition"
          >
            <Send className="h-4 w-4" />
            进入对话
          </button>
        </div>
      </div>
    </section>
    {chatOpen ? (
      <aside className={`arch-surface fixed bottom-4 top-16 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border ${
        dock === 'right' ? 'right-[400px]' : 'left-[400px]'
      } hidden xl:block`}>
        <div className="arch-border flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="arch-primary-text font-mono text-[10px] uppercase tracking-[0.24em]">
              Chat drawer
            </p>
            <h3 className="font-black">{module.zhName} 工程对话</h3>
          </div>
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            className="arch-btn flex h-9 w-9 items-center justify-center rounded-md"
            aria-label="关闭聊天抽屉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-65px)] overflow-y-auto p-4">
          <div className="space-y-3">
            {visibleMessages.map((message) => (
              <p key={`drawer-${message}`} className="arch-card-muted rounded-md px-3 py-3 text-sm leading-6">
                {message}
              </p>
            ))}
          </div>
          <div className="arch-card-muted mt-4 rounded-lg p-3">
            <p className="arch-muted text-sm leading-6">
              对话抽屉已接入当前模块上下文、审计记录和建议队列。
            </p>
          </div>
        </div>
      </aside>
    ) : null}
    </>
  );
}

function ProfileCard({
  followers,
  onCollect,
  onCopy,
}: {
  followers: string;
  onCollect: () => void;
  onCopy: () => void;
}) {
  const profile = architokenAssistantProfile;
  return (
    <div className="arch-card-muted overflow-hidden rounded-lg border">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="arch-btn-primary inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-black">
              <Star className="h-3.5 w-3.5" />
              {profile.level} · {profile.certification}
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{profile.role}</h3>
            <p className="arch-muted mt-2 text-sm leading-6">
              当前模块上下文、近期操作、建议队列和工程对话入口。
            </p>
          </div>
          <Home className="arch-primary-text h-5 w-5" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <ProfileStat label="作品" value={String(profile.works.length)} />
          <ProfileStat label="关注" value={followers} />
          <ProfileStat label="认证" value="AEC" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.capabilityTags.map((tag) => (
            <span key={tag} className="arch-chip rounded-md border px-3 py-1 text-xs font-bold">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {profile.works.slice(0, 6).map((work) => (
            <div key={work.id} className="arch-card rounded-md p-3">
              <p className="text-sm font-black">{work.title}</p>
              <p className="arch-primary-text mt-1 text-[10px] uppercase tracking-[0.18em]">
                {work.kind}
              </p>
              <p className="arch-muted mt-2 text-xs">{work.metric}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onCollect}
            className="arch-btn inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-black"
          >
            <Heart className="h-3.5 w-3.5" />
            收藏
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="arch-btn inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-black"
          >
            <Copy className="h-3.5 w-3.5" />
            复制
          </button>
          <button
            type="button"
            className="arch-btn-primary inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-black"
          >
            关注
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card p-3">
      <p className="arch-primary-text text-lg font-black">{value}</p>
      <p className="arch-muted mt-1 text-[10px] uppercase tracking-[0.18em]">{label}</p>
    </div>
  );
}

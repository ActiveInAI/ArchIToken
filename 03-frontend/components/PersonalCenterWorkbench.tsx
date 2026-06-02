// components/PersonalCenterWorkbench.tsx
// License: Apache-2.0
"use client";

import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  MailCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createModuleAuditEvent } from "@/lib/module-actions";
import { moduleBackendAdapter } from "@/lib/module-backend-adapter";
import {
  lifecycleStateLabels,
  type ModuleTransaction,
  type ModuleTransactionState,
} from "@/lib/module-lifecycle";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import {
  activeModuleIds,
  getModuleSpec,
  type ModuleId,
} from "@/lib/module-registry";

type Announcement = {
  id: string;
  title: string;
  scope: string;
  time: string;
  level: "important" | "normal" | "system";
  read: boolean;
};

type MeetingItem = {
  id: string;
  time: string;
  title: string;
  location: string;
  owner: string;
  moduleId: ModuleId;
  status: "upcoming" | "checked_in" | "done";
};

type ApprovalItem = {
  id: string;
  title: string;
  module: string;
  moduleId: ModuleId;
  transactionId?: string;
  requester: string;
  approver: string;
  createdAt: string;
  updatedAt: string;
  currentStep: string;
  relatedFileCount: number;
  relatedArtifactCount: number;
  process: ApprovalProcessStep[];
  history: ApprovalHistoryItem[];
  due: string;
  status: "urgent" | "waiting" | "review" | "approved" | "returned";
};

type ApprovalProcessStep = {
  id: ModuleTransactionState;
  label: string;
  state: "done" | "current" | "pending";
  at?: string;
  actor?: string;
  summary?: string;
};

type ApprovalHistoryItem = {
  id: string;
  at: string;
  actor: string;
  summary: string;
};

type RecentWorkItem = {
  id: string;
  module: string;
  moduleId?: ModuleId;
  title: string;
  time: string;
};

type PersonalProfile = {
  name: string;
  role: string;
  email: string;
  security: string;
  login: string;
};

const personalCenterStorageKey = "architoken.personal-center.workbench.v3";

const initialProfile: PersonalProfile = {
  name: "AI",
  role: "企业所有者 / 项目经理",
  email: "ai@architoken.local",
  security: "已启用二次验证",
  login: "192.168.1.100 · 今天",
};

type StoredPersonalCenterState = {
  noticeItems?: Announcement[];
  meetingItems?: MeetingItem[];
  approvalItems?: ApprovalItem[];
  recentItems?: RecentWorkItem[];
  profile?: PersonalProfile;
};

const statusLabels: Record<ApprovalItem["status"], string> = {
  urgent: "加急",
  waiting: "待处理",
  review: "复核",
  approved: "已通过",
  returned: "已退回",
};

const statusClassNames: Record<ApprovalItem["status"], string> = {
  urgent: "border-rose-200 bg-rose-50 text-rose-700",
  waiting: "border-amber-200 bg-amber-50 text-amber-700",
  review: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-blue-200 bg-blue-50 text-blue-700",
  returned: "border-slate-200 bg-slate-50 text-slate-600",
};

const meetingStatusLabels: Record<MeetingItem["status"], string> = {
  upcoming: "待开始",
  checked_in: "已签到",
  done: "已完成",
};

const approvalProcessStates: ModuleTransactionState[] = [
  "draft",
  "submitted",
  "generating",
  "evaluating",
  "rule_checking",
  "schema_validating",
  "pending_approval",
  "approved",
  "archived",
];

function formatTimestamp(value: string | undefined): string {
  if (!value) return "-";
  const normalized = value.replace("T", " ").replace(/\.\d{3}Z$/, "Z");
  if (normalized.endsWith("Z")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("zh-CN", {
        hour12: false,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return normalized.slice(0, 16);
}

function getOldestAudit(
  transaction: ModuleTransaction,
): ModuleAuditEvent | null {
  return transaction.auditTrail.at(-1) ?? null;
}

function findAuditForState(
  transaction: ModuleTransaction,
  state: ModuleTransactionState,
): ModuleAuditEvent | null {
  if (state === "draft") {
    return getOldestAudit(transaction);
  }
  return (
    [...transaction.auditTrail]
      .reverse()
      .find((event) => event.summary.includes(`-> ${state}`)) ?? null
  );
}

function buildApprovalProcess(
  transaction: ModuleTransaction,
): ApprovalProcessStep[] {
  const currentIndex = approvalProcessStates.indexOf(transaction.currentState);
  const states = approvalProcessStates.includes(transaction.currentState)
    ? approvalProcessStates
    : [...approvalProcessStates, transaction.currentState];

  return states.map((state, index) => {
    const audit = findAuditForState(transaction, state);
    const isCurrent = transaction.currentState === state;
    const isDone =
      Boolean(audit) || (currentIndex >= 0 && index < currentIndex);

    return {
      id: state,
      label: lifecycleStateLabels[state],
      state: isCurrent ? "current" : isDone ? "done" : "pending",
      ...(audit
        ? {
            at: formatTimestamp(audit.at),
            actor: audit.actor,
            summary: audit.summary,
          }
        : {}),
    };
  });
}

function buildApprovalItemFromTransaction(
  transaction: ModuleTransaction,
  index: number,
  overrideStatus?: ApprovalItem["status"],
): ApprovalItem {
  const spec = getModuleSpec(transaction.moduleId);
  const oldestAudit = getOldestAudit(transaction);
  const approval = transaction.approvals[0];
  const status =
    overrideStatus ??
    (transaction.status === "approved"
      ? ("approved" as const)
      : transaction.currentState === "rejected"
        ? ("returned" as const)
        : index === 0 && transaction.status === "waiting"
          ? ("urgent" as const)
          : transaction.currentState === "pending_approval"
            ? ("waiting" as const)
            : ("review" as const));

  return {
    id: `approval-${transaction.id}`,
    title: transaction.type,
    module: spec.zhName,
    moduleId: transaction.moduleId,
    transactionId: transaction.id,
    requester:
      oldestAudit?.actor && oldestAudit.actor !== "System"
        ? oldestAudit.actor
        : transaction.actor,
    approver: approval?.approver ?? spec.approvals[0]?.approver ?? "模块负责人",
    createdAt: formatTimestamp(transaction.createdAt),
    updatedAt: formatTimestamp(transaction.updatedAt),
    currentStep: lifecycleStateLabels[transaction.currentState],
    relatedFileCount: transaction.relatedFileIds.length,
    relatedArtifactCount: transaction.relatedArtifactIds.length,
    process: buildApprovalProcess(transaction),
    history: transaction.auditTrail.slice(0, 5).map((event) => ({
      id: event.id,
      at: formatTimestamp(event.at),
      actor: event.actor,
      summary: event.summary,
    })),
    due:
      transaction.status === "waiting" ||
      transaction.currentState === "pending_approval"
        ? "待审批"
        : "待推进",
    status,
  };
}

function buildLiveAnnouncements(): Announcement[] {
  const snapshot = moduleBackendAdapter.snapshot();
  const liveFiles = snapshot.files.filter(
    (file) => file.status !== "soft_deleted",
  );
  const approvalTransactions = snapshot.transactions.filter(
    (transaction) =>
      transaction.status === "waiting" ||
      transaction.currentState === "pending_approval",
  );
  const activeTransactions = snapshot.transactions.filter(
    (transaction) =>
      transaction.status === "waiting" ||
      transaction.status === "open" ||
      transaction.status === "blocked",
  );
  const uploadedCount = snapshot.uploadedFiles.length;
  const latestAudit = snapshot.auditEvents[0];

  return [
    {
      id: "notice-live-queue",
      title: `个人工作台已接入 ${activeModuleIds.length} 个模块，${approvalTransactions.length} 个事务等待审批，${activeTransactions.length} 个生命周期事务在运行`,
      scope: "Open CDE / 模块注册表",
      time: "实时",
      level: approvalTransactions.length > 0 ? "important" : "normal",
      read: false,
    },
    {
      id: "notice-cde-files",
      title: `当前会话可见 ${liveFiles.length} 个 CDE 文件节点，含 ${uploadedCount} 个本地上传文件`,
      scope: "数字档案 / 文件系统",
      time: "实时",
      level: "normal",
      read: false,
    },
    {
      id: "notice-audit-tail",
      title: latestAudit
        ? `最新审计: ${latestAudit.summary}`
        : "尚无新的会话审计事件，个人中心等待业务模块写入",
      scope: latestAudit?.actor ?? "审计链",
      time: latestAudit ? "最新" : "待写入",
      level: latestAudit ? "system" : "normal",
      read: false,
    },
  ];
}

function buildLiveMeetings(): MeetingItem[] {
  const slots = ["09:30", "14:00", "16:30", "明日 09:30"];
  return activeModuleIds
    .flatMap((moduleId) => {
      const spec = getModuleSpec(moduleId);
      return spec.tasks
        .filter((task) => task.state !== "done")
        .map((task, index) => ({
          id: `meeting-${moduleId}-${task.id}`,
          time: slots[index % slots.length] ?? "待定",
          title: task.title,
          location: `${spec.zhName}工作台`,
          owner: task.assignee,
          moduleId,
          status: "upcoming" as const,
        }));
    })
    .slice(0, 4);
}

function buildLiveApprovals(): ApprovalItem[] {
  const snapshot = moduleBackendAdapter.snapshot();
  return snapshot.transactions
    .filter(
      (transaction) =>
        transaction.status === "waiting" ||
        transaction.currentState === "pending_approval",
    )
    .slice(0, 6)
    .map((transaction, index) =>
      buildApprovalItemFromTransaction(transaction, index),
    );
}

function buildLiveRecentWork(): RecentWorkItem[] {
  const snapshot = moduleBackendAdapter.snapshot();
  const auditItems = snapshot.auditEvents.slice(0, 4).map((event, index) => ({
    id: `recent-audit-${event.id}`,
    module: "审计链",
    title: `${event.actor}: ${event.summary}`,
    time: index === 0 ? "刚刚" : `${index * 6 + 4} 分钟前`,
  }));

  if (auditItems.length > 0) {
    return auditItems;
  }

  return activeModuleIds.slice(0, 4).map((moduleId, index) => {
    const spec = getModuleSpec(moduleId);
    const firstTask = spec.tasks.find((task) => task.state !== "done");
    return {
      id: `recent-module-${moduleId}`,
      module: spec.zhName,
      moduleId,
      title: firstTask?.title ?? spec.summary,
      time: index === 0 ? "刚刚" : `${index * 12 + 5} 分钟前`,
    };
  });
}

function mergeNoticeState(
  liveItems: Announcement[],
  storedItems?: Announcement[],
): Announcement[] {
  const readById = new Map(storedItems?.map((item) => [item.id, item.read]));
  return liveItems.map((item) => ({
    ...item,
    read: readById.get(item.id) ?? item.read,
  }));
}

function mergeMeetingState(
  liveItems: MeetingItem[],
  storedItems?: MeetingItem[],
): MeetingItem[] {
  const statusById = new Map(
    storedItems?.map((item) => [item.id, item.status]),
  );
  return liveItems.map((item) => ({
    ...item,
    status: statusById.get(item.id) ?? item.status,
  }));
}

function mergeApprovalState(
  liveItems: ApprovalItem[],
  storedItems?: ApprovalItem[],
): ApprovalItem[] {
  const statusById = new Map(
    storedItems?.map((item) => [item.id, item.status]),
  );
  return liveItems.map((item) => ({
    ...item,
    status: statusById.get(item.id) ?? item.status,
  }));
}

export function PersonalCenterWorkbench({
  onAudit,
}: {
  compact?: boolean;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const router = useRouter();
  const [noticeItems, setNoticeItems] = useState<Announcement[]>(
    buildLiveAnnouncements,
  );
  const [meetingItems, setMeetingItems] =
    useState<MeetingItem[]>(buildLiveMeetings);
  const [approvalItems, setApprovalItems] =
    useState<ApprovalItem[]>(buildLiveApprovals);
  const [recentItems, setRecentItems] =
    useState<RecentWorkItem[]>(buildLiveRecentWork);
  const [profile, setProfile] = useState<PersonalProfile>(initialProfile);
  const [profileDraft, setProfileDraft] =
    useState<PersonalProfile>(initialProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [activityMessage, setActivityMessage] =
    useState("个人中心已加载最新工作流。");
  const [hydrated, setHydrated] = useState(false);

  const unreadNoticeCount = useMemo(
    () => noticeItems.filter((item) => !item.read).length,
    [noticeItems],
  );
  const pendingApprovalCount = useMemo(
    () =>
      approvalItems.filter(
        (item) => item.status !== "approved" && item.status !== "returned",
      ).length,
    [approvalItems],
  );
  const activeMeetingCount = useMemo(
    () => meetingItems.filter((item) => item.status !== "done").length,
    [meetingItems],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(personalCenterStorageKey);
        if (!raw) {
          setHydrated(true);
          return;
        }
        const stored = JSON.parse(raw) as StoredPersonalCenterState;
        setNoticeItems((current) =>
          mergeNoticeState(
            buildLiveAnnouncements(),
            stored.noticeItems ?? current,
          ),
        );
        setMeetingItems((current) =>
          mergeMeetingState(
            buildLiveMeetings(),
            stored.meetingItems ?? current,
          ),
        );
        setApprovalItems((current) =>
          mergeApprovalState(
            buildLiveApprovals(),
            stored.approvalItems ?? current,
          ),
        );
        if (stored.recentItems?.length) {
          setRecentItems(stored.recentItems);
        }
        if (stored.profile) {
          setProfile(stored.profile);
          setProfileDraft(stored.profile);
        }
      } catch {
        setActivityMessage("个人中心本地状态读取失败，已回退到当前会话数据。");
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredPersonalCenterState = {
      noticeItems,
      meetingItems,
      approvalItems,
      recentItems,
      profile,
    };
    window.localStorage.setItem(
      personalCenterStorageKey,
      JSON.stringify(payload),
    );
  }, [
    approvalItems,
    hydrated,
    meetingItems,
    noticeItems,
    profile,
    recentItems,
  ]);

  function emit(action: string, detail: string) {
    onAudit?.(
      createModuleAuditEvent(action, "PersonalCenterWorkbench", detail),
    );
  }

  function openModule(moduleId?: ModuleId) {
    if (!moduleId) {
      setActivityMessage("当前项目没有绑定可打开的业务模块。");
      return;
    }
    const spec = getModuleSpec(moduleId);
    setActivityMessage(`正在打开模块: ${spec.zhName}`);
    emit("personal-open-module", spec.zhName);
    router.push(spec.routeHref);
  }

  function syncLiveQueues() {
    const nextNotices = buildLiveAnnouncements();
    const nextMeetings = buildLiveMeetings();
    const nextApprovals = buildLiveApprovals();
    setNoticeItems((current) => mergeNoticeState(nextNotices, current));
    setMeetingItems((current) => mergeMeetingState(nextMeetings, current));
    setApprovalItems((current) => mergeApprovalState(nextApprovals, current));
    setRecentItems(buildLiveRecentWork());
    setActivityMessage("已从模块注册表、生命周期事务和 CDE 会话刷新个人中心。");
    emit("personal-live-sync", "刷新个人中心动态队列");
  }

  function pushRecent(module: string, title: string, moduleId?: ModuleId) {
    setRecentItems((current) => [
      {
        id: `recent-${Date.now()}-${current.length}`,
        module,
        ...(moduleId ? { moduleId } : {}),
        title,
        time: "刚刚",
      },
      ...current.slice(0, 5),
    ]);
  }

  function markNoticeRead(id: string) {
    const target = noticeItems.find((item) => item.id === id);
    if (!target || target.read) return;
    setNoticeItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    setActivityMessage(`已读通知: ${target.title}`);
    pushRecent("个人中心", `已读通知: ${target.scope}`);
    emit("personal-notice-read", target.title);
  }

  function markAllNoticesRead() {
    const unreadCount = unreadNoticeCount;
    setNoticeItems((current) =>
      current.map((item) => ({ ...item, read: true })),
    );
    setActivityMessage(`已处理 ${unreadCount} 条未读通知。`);
    pushRecent("个人中心", `公告通知全部标记已读: ${unreadCount} 条`);
    emit("personal-notices-read", `公告通知标记已读 ${unreadCount} 条`);
  }

  function advanceMeeting(id: string) {
    const target = meetingItems.find((item) => item.id === id);
    if (!target) return;
    const nextStatus: MeetingItem["status"] =
      target.status === "upcoming"
        ? "checked_in"
        : target.status === "checked_in"
          ? "done"
          : "done";
    setMeetingItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );
    const label = meetingStatusLabels[nextStatus];
    setActivityMessage(`${target.title}: ${label}`);
    pushRecent("会议日程", `${target.title} · ${label}`, target.moduleId);
    emit("personal-meeting-update", `${target.title} / ${label}`);
  }

  function processApproval(id: string, status: "approved" | "returned") {
    const target = approvalItems.find((item) => item.id === id);
    if (!target) return;
    const label = statusLabels[status];
    let updatedItem: ApprovalItem | null = null;
    if (target.transactionId) {
      try {
        const result =
          status === "approved"
            ? moduleBackendAdapter.approveTransaction(
                target.transactionId,
                profile.name,
                "个人中心快速通过",
              )
            : moduleBackendAdapter.rejectTransaction(
                target.transactionId,
                profile.name,
                "个人中心退回修改",
              );
        onAudit?.(result.auditEvent);
        const expectedState = status === "approved" ? "approved" : "rejected";
        if (result.transaction.currentState !== expectedState) {
          setActivityMessage(
            `审批未执行: ${target.title} 当前状态不允许${label}`,
          );
          return;
        }
        updatedItem = buildApprovalItemFromTransaction(
          result.transaction,
          0,
          status,
        );
      } catch {
        // The session dashboard still records the decision even if the
        // underlying lifecycle item has already moved.
      }
    }
    setApprovalItems((current) =>
      current.map((item) =>
        item.id === id ? (updatedItem ?? { ...item, status }) : item,
      ),
    );
    setActivityMessage(`${target.title}: ${label}`);
    pushRecent(target.module, `${target.title} · ${label}`, target.moduleId);
    emit("personal-approval-process", `${target.title} / ${label}`);
  }

  function refreshRecentWork() {
    setRecentItems(buildLiveRecentWork());
    setActivityMessage("最近工作时间线已从审计链刷新。");
    emit("personal-recent-refresh", "刷新最近工作");
  }

  function startEditProfile() {
    setProfileDraft(profile);
    setEditingProfile(true);
    setActivityMessage("正在编辑个人资料。");
    emit("personal-profile-edit", "打开个人资料维护");
  }

  function saveProfile() {
    setProfile(profileDraft);
    setEditingProfile(false);
    setActivityMessage(`个人资料已保存: ${profileDraft.name}`);
    pushRecent("个人中心", "更新个人资料");
    emit(
      "personal-profile-save",
      `${profileDraft.name} / ${profileDraft.role}`,
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/40">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-slate-100 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-600">
                  Personal Command Center
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  个人中心
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  汇总公告通知、会议日程、业务审批和个人资料，作为进入各业务模块前的工作台首页。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="待审批" value={pendingApprovalCount} />
                <MiniMetric label="待会议" value={activeMeetingCount} />
                <MiniMetric label="未读通知" value={unreadNoticeCount} />
              </div>
              <button
                type="button"
                onClick={syncLiveQueues}
                className="h-9 rounded-md border border-emerald-200 bg-white px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
              >
                刷新动态队列
              </button>
            </div>
            <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {activityMessage}
            </div>
          </div>

          <ProfileCard
            profile={profile}
            draft={profileDraft}
            editing={editingProfile}
            onEdit={startEditProfile}
            onCancel={() => {
              setProfileDraft(profile);
              setEditingProfile(false);
              setActivityMessage("已取消个人资料编辑。");
            }}
            onSave={saveProfile}
            onDraftChange={setProfileDraft}
          />
        </div>

        <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <DashboardPanel
            icon={<Bell className="h-4 w-4 text-emerald-600" />}
            title="公告通知"
            action="全部已读"
            onAction={markAllNoticesRead}
          >
            <div className="grid gap-2">
              {noticeItems.map((item) => (
                <AnnouncementRow
                  key={item.id}
                  item={item}
                  onRead={() => markNoticeRead(item.id)}
                />
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            icon={<CalendarDays className="h-4 w-4 text-emerald-600" />}
            title="会议日程"
            action="同步日历"
            onAction={() => {
              setActivityMessage("会议日程已同步到当前工作会话。");
              pushRecent("会议日程", "同步会议日历");
              emit("personal-calendar-sync", "会议日程同步日历");
            }}
          >
            <div className="grid gap-2">
              {meetingItems.map((item) => (
                <MeetingRow
                  key={item.id}
                  item={item}
                  onAdvance={() => advanceMeeting(item.id)}
                  onOpen={() => openModule(item.moduleId)}
                />
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            title="业务审批"
            action="进入审批"
            onAction={() => {
              setActivityMessage(
                `当前还有 ${pendingApprovalCount} 条待办审批。`,
              );
              emit("personal-approval-open", "进入个人审批列表");
            }}
          >
            <div className="grid gap-2">
              {approvalItems.map((item) => (
                <ApprovalRow
                  key={item.id}
                  item={item}
                  onApprove={() => processApproval(item.id, "approved")}
                  onReturn={() => processApproval(item.id, "returned")}
                  onOpen={() => openModule(item.moduleId)}
                />
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            icon={<FileText className="h-4 w-4 text-emerald-600" />}
            title="最近工作"
            action="刷新"
            onAction={refreshRecentWork}
          >
            <div className="grid gap-2">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[88px_minmax(0,1fr)_72px_56px] items-center gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2"
                >
                  <span className="text-xs font-medium text-emerald-700">
                    {item.module}
                  </span>
                  <span className="truncate text-sm text-slate-800">
                    {item.title}
                  </span>
                  <span className="text-right text-xs text-slate-400">
                    {item.time}
                  </span>
                  <button
                    type="button"
                    onClick={() => openModule(item.moduleId)}
                    disabled={!item.moduleId}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ExternalLink className="h-3 w-3" />
                    打开
                  </button>
                </div>
              ))}
            </div>
          </DashboardPanel>
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[82px] rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-lg font-semibold text-slate-950">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function DashboardPanel({
  icon,
  title,
  action,
  onAction,
  children,
}: {
  icon: ReactNode;
  title: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="min-h-[220px] rounded-md border border-slate-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
        >
          {action}
        </button>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function AnnouncementRow({
  item,
  onRead,
}: {
  item: Announcement;
  onRead: () => void;
}) {
  const levelClassName =
    item.level === "important"
      ? "bg-rose-50 text-rose-600"
      : item.level === "system"
        ? "bg-blue-50 text-blue-600"
        : "bg-emerald-50 text-emerald-600";
  return (
    <div
      className={[
        "grid grid-cols-[36px_minmax(0,1fr)_64px_72px] items-center gap-3 rounded-md border px-3 py-2",
        item.read
          ? "border-slate-100 bg-white text-slate-500"
          : "border-emerald-100 bg-emerald-50/30",
      ].join(" ")}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-md ${levelClassName}`}
      >
        <MailCheck className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {item.scope}
        </span>
      </span>
      <span className="text-right font-mono text-xs text-slate-400">
        {item.time}
      </span>
      <button
        type="button"
        onClick={onRead}
        disabled={item.read}
        className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {item.read ? "已读" : "标为已读"}
      </button>
    </div>
  );
}

function MeetingRow({
  item,
  onAdvance,
  onOpen,
}: {
  item: MeetingItem;
  onAdvance: () => void;
  onOpen: () => void;
}) {
  const actionLabel =
    item.status === "upcoming"
      ? "签到"
      : item.status === "checked_in"
        ? "完成"
        : "完成";
  return (
    <div
      className={[
        "grid grid-cols-[56px_minmax(0,1fr)_72px_112px] items-center gap-3 rounded-md border px-3 py-2",
        item.status === "done"
          ? "border-slate-100 bg-white opacity-70"
          : "border-slate-100 bg-slate-50/70",
      ].join(" ")}
    >
      <span className="font-mono text-sm font-semibold text-emerald-700">
        {item.time}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {item.location} · {item.owner}
        </span>
      </span>
      <span className="justify-self-end rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600">
        {meetingStatusLabels[item.status]}
      </span>
      <span className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
        >
          <ExternalLink className="h-3 w-3" />
          打开
        </button>
        <button
          type="button"
          onClick={onAdvance}
          disabled={item.status === "done"}
          className="h-7 rounded-md bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {actionLabel}
        </button>
      </span>
    </div>
  );
}

function ApprovalRow({
  item,
  onApprove,
  onReturn,
  onOpen,
}: {
  item: ApprovalItem;
  onApprove: () => void;
  onReturn: () => void;
  onOpen: () => void;
}) {
  const closed = item.status === "approved" || item.status === "returned";
  return (
    <div
      className={[
        "rounded-md border px-3 py-3",
        closed
          ? "border-slate-100 bg-white opacity-75"
          : "border-slate-100 bg-slate-50/70",
      ].join(" ")}
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {item.title}
            </span>
            <span className="mt-1 block truncate text-xs text-slate-500">
              {item.module} · {item.due} · 当前环节 {item.currentStep}
            </span>
          </span>
          <span className="flex justify-end gap-1">
            <span
              className={`h-7 rounded border px-2 py-1 text-xs ${statusClassNames[item.status]}`}
            >
              {statusLabels[item.status]}
            </span>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
            >
              <ExternalLink className="h-3 w-3" />
              打开
            </button>
            {closed ? (
              <span className="h-7 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
                已处理
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onReturn}
                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-amber-200 hover:text-amber-700"
                >
                  退回
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  className="h-7 rounded-md bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                >
                  通过
                </button>
              </>
            )}
          </span>
        </div>

        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
          <InfoValue label="发起人" value={item.requester} />
          <InfoValue label="发起时间" value={item.createdAt} />
          <InfoValue label="审批人" value={item.approver} />
          <InfoValue label="最后更新" value={item.updatedAt} />
          <InfoValue label="关联文件" value={`${item.relatedFileCount} 个`} />
          <InfoValue
            label="关联交付物"
            value={`${item.relatedArtifactCount} 个`}
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">全流程</div>
          <div className="flex flex-wrap gap-1.5">
            {item.process.map((step) => (
              <ProcessPill key={step.id} step={step} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">
            已经过的流程与时间
          </div>
          <div className="grid gap-1">
            {item.history.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[92px_128px_minmax(0,1fr)] gap-2 rounded border border-slate-100 bg-white px-2 py-1 text-xs"
              >
                <span className="font-mono text-slate-500">{event.at}</span>
                <span className="truncate text-slate-500">{event.actor}</span>
                <span className="truncate text-slate-700">{event.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-100 bg-white px-2 py-1">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium text-slate-700">
        {value}
      </div>
    </div>
  );
}

function ProcessPill({ step }: { step: ApprovalProcessStep }) {
  const className =
    step.state === "current"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : step.state === "done"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-400";
  const title = [step.label, step.actor, step.at, step.summary]
    .filter(Boolean)
    .join(" / ");
  return (
    <span
      title={title}
      className={`rounded border px-2 py-1 text-[11px] ${className}`}
    >
      {step.label}
      {step.at ? ` · ${step.at}` : ""}
    </span>
  );
}

function ProfileCard({
  profile,
  draft,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDraftChange,
}: {
  profile: PersonalProfile;
  draft: PersonalProfile;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (draft: PersonalProfile) => void;
}) {
  const display = editing ? draft : profile;
  return (
    <section className="rounded-md border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <UserRound className="h-4 w-4 text-emerald-600" />
        个人资料
      </div>
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-emerald-600 text-lg font-semibold text-white">
          {display.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {editing ? (
                <div className="grid gap-2">
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      onDraftChange({ ...draft, name: event.target.value })
                    }
                    className="h-8 rounded-md border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-emerald-300"
                  />
                  <input
                    value={draft.role}
                    onChange={(event) =>
                      onDraftChange({ ...draft, role: event.target.value })
                    }
                    className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-emerald-300"
                  />
                </div>
              ) : (
                <>
                  <h3 className="truncate text-sm font-semibold text-slate-950">
                    {profile.name}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    {profile.role}
                  </p>
                </>
              )}
            </div>
            {editing ? (
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={onCancel}
                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-slate-300"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className="h-7 rounded-md bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                >
                  保存
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
              >
                编辑
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-600">
            {editing ? (
              <label className="grid gap-1 text-xs text-slate-500">
                邮箱
                <input
                  value={draft.email}
                  onChange={(event) =>
                    onDraftChange({ ...draft, email: event.target.value })
                  }
                  className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-emerald-300"
                />
              </label>
            ) : (
              <ProfileLine
                icon={<UserRound className="h-3.5 w-3.5" />}
                label="账号"
                value={profile.email}
              />
            )}
            <ProfileLine
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="安全"
              value={display.security}
            />
            <ProfileLine
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="最近登录"
              value={display.login}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-emerald-600">{icon}</span>
      <span className="w-14 shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-slate-700">{value}</span>
    </div>
  );
}

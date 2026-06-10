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
  History,
  Inbox,
  ListChecks,
  MailCheck,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Empty,
  Input,
  Segmented,
  Select,
  Tag,
} from "@/components/pan-ui";
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
  approvalId?: string;
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

type ApprovalFilter = "pending" | "all" | "closed";

type PersonalContextMenuTarget =
  | {
      kind: "approval";
      itemId: string;
    }
  | {
      kind: "notice";
      itemId: string;
    }
  | {
      kind: "meeting";
      itemId: string;
    }
  | {
      kind: "recent";
      itemId: string;
    }
  | {
      kind: "profile";
    }
  | {
      kind: "workspace";
    };

type PersonalContextMenuState = PersonalContextMenuTarget & {
  x: number;
  y: number;
};

type PersonalProfile = {
  name: string;
  role: string;
  email: string;
  security: string;
  login: string;
};

type ApprovalDraft = {
  moduleId: ModuleId;
  title: string;
  approver: string;
};

type IdentityPersonSearchHit = {
  id: string;
  name: string;
  account: string;
  email: string;
};

const personalCenterStorageKey = "architoken.personal-center.workbench.v3";
const settingsIdentityRegistryStorageKey =
  "architoken.settings.identityRegistry.v1";

const initialProfile: PersonalProfile = {
  name: "AI",
  role: "企业所有者 / 项目经理",
  email: "ai@architoken.local",
  security: "已启用二次验证",
  login: "192.168.1.100 · 今天",
};

const defaultApprovalModuleId: ModuleId =
  activeModuleIds[0] ?? "personal_center";

const initialApprovalDraft: ApprovalDraft = {
  moduleId: defaultApprovalModuleId,
  title: "",
  approver: "业务负责人",
};

const identityPeopleSearchIndex: IdentityPersonSearchHit[] = [
  {
    id: "person-pikachu",
    name: "皮卡丘",
    account: "pikachu",
    email: "pikachu@architoken.local",
  },
  {
    id: "person-strawberry-bear",
    name: "草莓熊",
    account: "strawberry.bear",
    email: "strawberry.bear@architoken.local",
  },
  {
    id: "person-donald-duck",
    name: "唐老鸭",
    account: "donald.duck",
    email: "donald.duck@architoken.local",
  },
  {
    id: "person-mickey-mouse",
    name: "米老鼠",
    account: "mickey.mouse",
    email: "mickey.mouse@architoken.local",
  },
  {
    id: "person-tom-cat",
    name: "汤姆猫",
    account: "tom.cat",
    email: "tom.cat@architoken.local",
  },
];

type StoredIdentityPerson = {
  id?: unknown;
  fullName?: unknown;
  accountName?: unknown;
  email?: unknown;
  status?: unknown;
};

type StoredPersonalCenterState = {
  noticeItems?: Announcement[];
  meetingItems?: MeetingItem[];
  approvalItems?: ApprovalItem[];
  recentItems?: RecentWorkItem[];
  profile?: PersonalProfile;
};

type RuntimeActivityItem = {
  id: string;
  at: string;
  actor: string;
  summary: string;
  module: string;
  moduleId?: ModuleId;
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
  review:
    "border-[color:var(--module-accent)] bg-[color:var(--module-accent-soft)] text-[color:var(--module-accent)]",
  approved: "border-blue-200 bg-blue-50 text-blue-700",
  returned: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusTagColors: Record<ApprovalItem["status"], string> = {
  urgent: "red",
  waiting: "gold",
  review: "blue",
  approved: "green",
  returned: "default",
};

const approvalFilterOptions: Array<{
  label: string;
  value: ApprovalFilter;
}> = [
  { label: "待处理", value: "pending" },
  { label: "全部", value: "all" },
  { label: "已关闭", value: "closed" },
];

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

function isApprovalClosed(item: ApprovalItem): boolean {
  return item.status === "approved" || item.status === "returned";
}

function clampContextMenuPoint(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  const width = 228;
  const height = 260;
  return {
    x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - height - 8)),
  };
}

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

function isSeedAuditEvent(event: ModuleAuditEvent): boolean {
  return (
    event.id.startsWith("seed-") ||
    event.id.startsWith("lifecycle-seed-") ||
    event.summary.startsWith("seed ") ||
    event.summary.includes("default transaction created")
  );
}

function isSeedTransaction(transaction: ModuleTransaction): boolean {
  return (
    transaction.id.endsWith("-txn-001") &&
    transaction.auditTrail.some((event) =>
      event.id.startsWith("lifecycle-seed-"),
    )
  );
}

function isRealTransaction(transaction: ModuleTransaction): boolean {
  return !isSeedTransaction(transaction);
}

function readIdentityPeopleSearchIndex(): IdentityPersonSearchHit[] {
  if (typeof window === "undefined") return identityPeopleSearchIndex;
  try {
    const raw = window.localStorage.getItem(settingsIdentityRegistryStorageKey);
    if (!raw) return identityPeopleSearchIndex;
    const parsed = JSON.parse(raw) as { people?: StoredIdentityPerson[] };
    if (!Array.isArray(parsed.people)) return identityPeopleSearchIndex;
    const people = parsed.people
      .map((person): IdentityPersonSearchHit | null => {
        const name =
          typeof person.fullName === "string" ? person.fullName.trim() : "";
        const account =
          typeof person.accountName === "string"
            ? person.accountName.trim()
            : "";
        const email =
          typeof person.email === "string" ? person.email.trim() : "";
        if (!name || !account) return null;
        return {
          id: typeof person.id === "string" ? person.id : `person-${account}`,
          name,
          account,
          email,
        };
      })
      .filter((person): person is IdentityPersonSearchHit => Boolean(person));
    return people.length > 0 ? people : identityPeopleSearchIndex;
  } catch {
    return identityPeopleSearchIndex;
  }
}

function findIdentityPeople(
  query: string,
  people: IdentityPersonSearchHit[],
): IdentityPersonSearchHit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return people.filter((person) =>
    [person.name, person.account, person.email]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function collectRuntimeActivities(): RuntimeActivityItem[] {
  const snapshot = moduleBackendAdapter.snapshot();
  const items: RuntimeActivityItem[] = [];

  snapshot.auditEvents
    .filter((event) => !isSeedAuditEvent(event))
    .forEach((event) => {
      items.push({
        id: event.id,
        at: event.at,
        actor: event.actor,
        summary: event.summary,
        module: "审计链",
      });
    });

  snapshot.transactions.filter(isRealTransaction).forEach((transaction) => {
    const spec = getModuleSpec(transaction.moduleId);
    transaction.auditTrail
      .filter((event) => !isSeedAuditEvent(event))
      .forEach((event) => {
        items.push({
          id: event.id,
          at: event.at,
          actor: event.actor,
          summary: event.summary,
          module: spec.zhName,
          moduleId: transaction.moduleId,
        });
      });
  });

  snapshot.files
    .filter((file) => file.source !== "seed")
    .forEach((file) => {
      const spec = getModuleSpec(file.moduleId);
      file.auditTrail
        .filter((event) => !isSeedAuditEvent(event))
        .forEach((event) => {
          items.push({
            id: event.id,
            at: event.at,
            actor: event.actor,
            summary: event.summary,
            module: spec.zhName,
            moduleId: file.moduleId,
          });
        });
    });

  return items
    .filter(
      (item, index, all) =>
        all.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 24);
}

function buildLiveAnnouncements(): Announcement[] {
  const snapshot = moduleBackendAdapter.snapshot();
  const approvalTransactions = snapshot.transactions.filter(
    (transaction) =>
      isRealTransaction(transaction) &&
      (transaction.status === "waiting" ||
        transaction.currentState === "pending_approval"),
  );
  const approvalNotices = approvalTransactions
    .slice(0, 2)
    .map((transaction) => {
      const spec = getModuleSpec(transaction.moduleId);
      return {
        id: `notice-approval-${transaction.id}`,
        title: `待处理审批: ${transaction.type}`,
        scope: spec.zhName,
        time: formatTimestamp(transaction.updatedAt),
        level: "important" as const,
        read: false,
        approvalId: `approval-${transaction.id}`,
      };
    });

  const usedIds = new Set(approvalNotices.map((item) => item.id));
  const activityNotices = collectRuntimeActivities()
    .filter((item) => !usedIds.has(`notice-approval-${item.id}`))
    .slice(0, Math.max(0, 3 - approvalNotices.length))
    .map((item) => ({
      id: `notice-audit-${item.id}`,
      title: item.summary,
      scope: `${item.module} / ${item.actor}`,
      time: formatTimestamp(item.at),
      level: "system" as const,
      read: false,
    }));

  return [...approvalNotices, ...activityNotices];
}

function buildLiveMeetings(): MeetingItem[] {
  return [];
}

function buildLiveApprovals(): ApprovalItem[] {
  const snapshot = moduleBackendAdapter.snapshot();
  return snapshot.transactions
    .filter(
      (transaction) =>
        isRealTransaction(transaction) &&
        (transaction.status === "waiting" ||
          transaction.currentState === "pending_approval"),
    )
    .slice(0, 6)
    .map((transaction, index) =>
      buildApprovalItemFromTransaction(transaction, index),
    );
}

function buildLiveRecentWork(): RecentWorkItem[] {
  return collectRuntimeActivities()
    .slice(0, 6)
    .map((item) => ({
      id: `recent-audit-${item.id}`,
      module: item.module,
      ...(item.moduleId ? { moduleId: item.moduleId } : {}),
      title: `${item.actor}: ${item.summary}`,
      time: formatTimestamp(item.at),
    }));
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
  const [approvalDraft, setApprovalDraft] =
    useState<ApprovalDraft>(initialApprovalDraft);
  const [identityPeople, setIdentityPeople] = useState<
    IdentityPersonSearchHit[]
  >(readIdentityPeopleSearchIndex);
  const [creatingApproval, setCreatingApproval] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [activityMessage, setActivityMessage] =
    useState("个人中心仅显示真实运行时数据。");
  const [hydrated, setHydrated] = useState(false);
  const [approvalFilter, setApprovalFilter] =
    useState<ApprovalFilter>("pending");
  const [approvalSearch, setApprovalSearch] = useState("");
  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] =
    useState<PersonalContextMenuState | null>(null);

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
  const closedApprovalCount = useMemo(
    () => approvalItems.filter(isApprovalClosed).length,
    [approvalItems],
  );
  const visibleApprovalItems = useMemo(() => {
    const query = approvalSearch.trim().toLowerCase();
    return approvalItems.filter((item) => {
      const filterMatched =
        approvalFilter === "all" ||
        (approvalFilter === "pending" && !isApprovalClosed(item)) ||
        (approvalFilter === "closed" && isApprovalClosed(item));
      if (!filterMatched) return false;
      if (!query) return true;
      return [
        item.title,
        item.module,
        item.requester,
        item.approver,
        item.currentStep,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [approvalFilter, approvalItems, approvalSearch]);
  const identitySearchHits = useMemo(
    () => findIdentityPeople(approvalSearch, identityPeople),
    [approvalSearch, identityPeople],
  );
  const selectedApproval = useMemo(
    () =>
      visibleApprovalItems.find((item) => item.id === activeApprovalId) ??
      visibleApprovalItems[0] ??
      null,
    [activeApprovalId, visibleApprovalItems],
  );
  const approvalModuleOptions = useMemo(
    () =>
      activeModuleIds.map((moduleId) => ({
        label: getModuleSpec(moduleId).zhName,
        value: moduleId,
      })),
    [],
  );
  const approvalApproverOptions = useMemo(
    () => [
      { label: "业务负责人", value: "业务负责人" },
      { label: "模块负责人", value: "模块负责人" },
      ...identityPeople.map((person) => ({
        label: `${person.name} / ${person.account}`,
        value: person.name,
      })),
    ],
    [identityPeople],
  );

  useEffect(() => {
    const syncIdentityPeople = () =>
      setIdentityPeople(readIdentityPeopleSearchIndex());
    const frame = window.requestAnimationFrame(syncIdentityPeople);
    window.addEventListener("storage", syncIdentityPeople);
    window.addEventListener("focus", syncIdentityPeople);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", syncIdentityPeople);
      window.removeEventListener("focus", syncIdentityPeople);
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!profilePanelOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-personal-profile-menu]")) return;
      setProfileDraft(profile);
      setProfileEditing(false);
      setProfilePanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProfileDraft(profile);
      setProfileEditing(false);
      setProfilePanelOpen(false);
      setActivityMessage("已关闭个人资料面板。");
    };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [profilePanelOpen, profile]);

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

  function selectApproval(item: ApprovalItem) {
    setActiveApprovalId(item.id);
    setActivityMessage(`已选中审批: ${item.title}`);
  }

  function selectApprovalById(id: string) {
    const item = approvalItems.find((approval) => approval.id === id);
    if (!item) {
      setActivityMessage("该审批事件已不在当前真实队列中。");
      return;
    }
    setApprovalFilter(isApprovalClosed(item) ? "all" : "pending");
    setApprovalSearch("");
    selectApproval(item);
  }

  function openContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    target: PersonalContextMenuTarget,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const point = clampContextMenuPoint(event.clientX, event.clientY);
    setContextMenu({
      ...target,
      ...point,
    } as PersonalContextMenuState);
  }

  function closeContextMenu() {
    setContextMenu(null);
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
    setActivityMessage("已从真实 CDE、生命周期事务和审计来源刷新个人中心。");
    emit("personal-live-sync", "刷新个人中心动态队列");
  }

  function openCreateApproval() {
    setIdentityPeople(readIdentityPeopleSearchIndex());
    setApprovalDraft((current) => ({
      moduleId: current.moduleId,
      title: current.title,
      approver: current.approver || initialApprovalDraft.approver,
    }));
    setCreatingApproval(true);
    setActivityMessage("正在新建真实审批事务。");
    emit("personal-approval-create-open", "打开新建审批");
  }

  function cancelCreateApproval() {
    setApprovalDraft(initialApprovalDraft);
    setCreatingApproval(false);
    setActivityMessage("已取消新建审批。");
  }

  function createApproval() {
    const title = approvalDraft.title.trim();
    if (!title) {
      setActivityMessage("请先填写审批事项名称。");
      return;
    }

    const created = moduleBackendAdapter.createTransaction({
      moduleId: approvalDraft.moduleId,
      type: title,
      approver: approvalDraft.approver,
    });
    const submitted = moduleBackendAdapter.transitionTransaction(
      created.transaction.id,
      "submit",
    );
    const requested = moduleBackendAdapter.transitionTransaction(
      created.transaction.id,
      "request_approval",
    );

    onAudit?.(created.auditEvent);
    onAudit?.(submitted.auditEvent);
    onAudit?.(requested.auditEvent);

    const nextApprovals = buildLiveApprovals();
    setApprovalItems(nextApprovals);
    setNoticeItems((current) =>
      mergeNoticeState(buildLiveAnnouncements(), current),
    );
    setRecentItems(buildLiveRecentWork());
    setApprovalFilter("pending");
    setActiveApprovalId(`approval-${requested.transaction.id}`);
    setApprovalDraft(initialApprovalDraft);
    setCreatingApproval(false);
    setActivityMessage(`已新建审批: ${title}`);
    emit("personal-approval-create", title);
  }

  function focusPendingApprovals() {
    setApprovalFilter("pending");
    const firstPending = approvalItems.find((item) => !isApprovalClosed(item));
    if (firstPending) {
      selectApproval(firstPending);
    } else {
      setActiveApprovalId(null);
      setActivityMessage("当前没有待处理审批。");
    }
    emit("personal-focus-pending", "定位个人待处理审批");
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
    if (unreadCount === 0) {
      setActivityMessage("当前没有未读真实通知。");
      return;
    }
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
    setActivityMessage("最近工作已从真实审计来源刷新。");
    emit("personal-recent-refresh", "刷新最近工作");
  }

  function syncCalendar() {
    if (meetingItems.length === 0) {
      setActivityMessage("未接入真实日历来源，暂无可同步会议。");
      return;
    }
    setActivityMessage("会议日程已同步到当前工作会话。");
    pushRecent("会议日程", "同步真实会议日历");
    emit("personal-calendar-sync", "会议日程同步日历");
  }

  function startEditProfile() {
    setProfileDraft(profile);
    setProfilePanelOpen(true);
    setProfileEditing(true);
    setActivityMessage("正在编辑个人资料。");
    emit("personal-profile-edit", "打开个人资料维护");
  }

  function toggleProfilePanel() {
    if (profilePanelOpen) {
      setProfileDraft(profile);
      setProfileEditing(false);
      setProfilePanelOpen(false);
      setActivityMessage("已关闭个人资料面板。");
      return;
    }
    setProfileDraft(profile);
    setProfileEditing(false);
    setProfilePanelOpen(true);
    setActivityMessage("已打开账号资料。");
    emit("personal-profile-open", "打开账号资料面板");
  }

  function saveProfile() {
    setProfile(profileDraft);
    setProfileEditing(false);
    setProfilePanelOpen(false);
    setActivityMessage(`个人资料已保存: ${profileDraft.name}`);
    pushRecent("个人中心", "更新个人资料");
    emit(
      "personal-profile-save",
      `${profileDraft.name} / ${profileDraft.role}`,
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8fafc] text-[var(--arch-text)]">
      <header className="flex min-h-[60px] shrink-0 flex-wrap items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2">
        <div className="flex min-w-[280px] flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--module-accent-soft)] text-[color:var(--module-accent)]">
            <Inbox className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-[#5f6368]">
                Personal Command Center
              </p>
              <span className="rounded-full border border-[#dfe1e5] bg-white px-2 py-0.5 text-[11px] font-medium text-[#188038]">
                Open CDE 工作入口
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-medium text-[#202124]">
                个人中心
              </h2>
              <span className="rounded-full border border-[color:var(--module-accent)] bg-[color:var(--module-accent-soft)] px-2.5 py-0.5 text-xs text-[color:var(--module-accent)]">
                {activityMessage}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 text-center md:flex">
          <MetricCell label="待审批" value={pendingApprovalCount} />
          <MetricCell label="已关闭" value={closedApprovalCount} />
          <MetricCell label="会议" value={activeMeetingCount} />
          <MetricCell label="未读" value={unreadNoticeCount} />
        </div>

        <Button
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          size="small"
          type="primary"
          onClick={syncLiveQueues}
        >
          刷新动态队列
        </Button>
        <div className="relative" data-personal-profile-menu="true">
          <AccountButton
            open={profilePanelOpen}
            profile={profile}
            onClick={toggleProfilePanel}
            onContextMenu={(event) =>
              openContextMenu(event, { kind: "profile" })
            }
          />
          {profilePanelOpen ? (
            <AccountPanel
              draft={profileDraft}
              editing={profileEditing}
              profile={profile}
              onCancel={() => {
                setProfileDraft(profile);
                setProfileEditing(false);
                setProfilePanelOpen(false);
                setActivityMessage("已取消个人资料编辑。");
              }}
              onDraftChange={setProfileDraft}
              onEdit={startEditProfile}
              onSave={saveProfile}
            />
          ) : null}
        </div>
      </header>

      <div
        className="m-3 grid min-h-0 flex-1 grid-cols-1 overflow-auto rounded-lg border border-[#e8eaed] bg-white xl:grid-cols-[340px_minmax(520px,1fr)_360px] xl:overflow-hidden"
        onContextMenu={(event) => openContextMenu(event, { kind: "workspace" })}
      >
        <section className="flex min-h-[260px] min-w-0 flex-col overflow-hidden border-r border-[#e8eaed] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#e8eaed] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <ListChecks className="h-4 w-4 text-[color:var(--module-accent)]" />
              <h3 className="truncate text-sm font-medium text-[#202124]">
                业务审批
              </h3>
              <span className="rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[11px] text-[#5f6368]">
                {visibleApprovalItems.length} 条
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                icon={<Plus className="h-3.5 w-3.5" />}
                size="small"
                type="primary"
                onClick={openCreateApproval}
              >
                新建审批
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setApprovalFilter("pending");
                  setActivityMessage(
                    `当前还有 ${pendingApprovalCount} 条待办审批。`,
                  );
                  emit("personal-approval-open", "进入个人审批列表");
                }}
              >
                进入审批
              </Button>
            </div>
          </div>
          <div className="grid gap-2 border-b border-[#e8eaed] bg-[#fafafa] p-2.5">
            <Segmented
              block
              options={approvalFilterOptions}
              value={approvalFilter}
              onChange={setApprovalFilter}
            />
            <Input
              prefix={<Search className="h-3.5 w-3.5" />}
              placeholder="搜索审批、模块、人员"
              size="small"
              value={approvalSearch}
              onChange={(event) => setApprovalSearch(event.target.value)}
            />
          </div>
          {creatingApproval ? (
            <CreateApprovalPanel
              approverOptions={approvalApproverOptions}
              draft={approvalDraft}
              moduleOptions={approvalModuleOptions}
              onCancel={cancelCreateApproval}
              onChange={setApprovalDraft}
              onSubmit={createApproval}
            />
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">
            {visibleApprovalItems.length > 0 ? (
              <table className="w-full table-fixed border-collapse text-xs">
                <thead className="bg-[var(--arch-surface-muted)] text-[var(--arch-text-muted)]">
                  <tr className="border-b border-[var(--arch-border)]">
                    <th className="w-[44%] px-3 py-1.5 text-left font-medium">
                      事项
                    </th>
                    <th className="w-[20%] px-2 py-1.5 text-left font-medium">
                      状态
                    </th>
                    <th className="w-[22%] px-2 py-1.5 text-left font-medium">
                      更新时间
                    </th>
                    <th className="w-[14%] px-2 py-1.5 text-right font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleApprovalItems.map((item) => (
                    <ApprovalQueueRow
                      key={item.id}
                      active={selectedApproval?.id === item.id}
                      item={item}
                      onContextMenu={(event) =>
                        openContextMenu(event, {
                          kind: "approval",
                          itemId: item.id,
                        })
                      }
                      onSelect={() => selectApproval(item)}
                    />
                  ))}
                </tbody>
              </table>
            ) : (
              <ApprovalQueueEmpty
                creatingApproval={creatingApproval}
                identitySearchHits={identitySearchHits}
                searchQuery={approvalSearch}
                onClearSearch={() => {
                  setApprovalSearch("");
                  setActivityMessage("已清空审批搜索。");
                }}
                onCreateApproval={openCreateApproval}
              />
            )}
          </div>
          <div className="grid grid-cols-3 border-t border-[#e8eaed] bg-[#fafafa] text-center text-xs">
            <QueueStat label="待处理" value={pendingApprovalCount} />
            <QueueStat label="已关闭" value={closedApprovalCount} />
            <QueueStat label="总审批" value={approvalItems.length} />
          </div>
        </section>

        <ApprovalInspector
          identitySearchHits={identitySearchHits}
          item={selectedApproval}
          searchQuery={approvalSearch}
          totalApprovalCount={approvalItems.length}
          visibleApprovalCount={visibleApprovalItems.length}
          onClearSearch={() => {
            setApprovalSearch("");
            setActivityMessage("已清空审批搜索。");
          }}
          onContextMenu={(event) => {
            if (selectedApproval) {
              openContextMenu(event, {
                kind: "approval",
                itemId: selectedApproval.id,
              });
              return;
            }
            openContextMenu(event, { kind: "workspace" });
          }}
          onApprove={(id) => processApproval(id, "approved")}
          onCreateApproval={openCreateApproval}
          onOpen={(moduleId) => openModule(moduleId)}
          onRefresh={syncLiveQueues}
          onReturn={(id) => processApproval(id, "returned")}
        />

        <ContextRail
          meetingItems={meetingItems}
          noticeItems={noticeItems}
          recentItems={recentItems}
          onAdvanceMeeting={advanceMeeting}
          onMarkAllNoticesRead={markAllNoticesRead}
          onMarkNoticeRead={markNoticeRead}
          onOpenModule={openModule}
          onRefreshRecentWork={refreshRecentWork}
          onSelectApprovalById={selectApprovalById}
          onSyncCalendar={syncCalendar}
          onOpenContextMenu={openContextMenu}
        />
      </div>
      <PersonalContextMenu
        approvalItems={approvalItems}
        contextMenu={contextMenu}
        meetingItems={meetingItems}
        noticeItems={noticeItems}
        recentItems={recentItems}
        onAdvanceMeeting={advanceMeeting}
        onClose={closeContextMenu}
        onCreateApproval={openCreateApproval}
        onEditProfile={startEditProfile}
        onFocusPendingApprovals={focusPendingApprovals}
        onMarkAllNoticesRead={markAllNoticesRead}
        onMarkNoticeRead={markNoticeRead}
        onOpenModule={openModule}
        onProcessApproval={processApproval}
        onRefreshRecentWork={refreshRecentWork}
        onSelectApproval={(item) => selectApprovalById(item.id)}
        onSyncCalendar={syncCalendar}
        onSyncLiveQueues={syncLiveQueues}
      />
    </section>
  );
}

function PersonalContextMenu({
  approvalItems,
  contextMenu,
  meetingItems,
  noticeItems,
  recentItems,
  onAdvanceMeeting,
  onClose,
  onCreateApproval,
  onEditProfile,
  onFocusPendingApprovals,
  onMarkAllNoticesRead,
  onMarkNoticeRead,
  onOpenModule,
  onProcessApproval,
  onRefreshRecentWork,
  onSelectApproval,
  onSyncCalendar,
  onSyncLiveQueues,
}: {
  approvalItems: ApprovalItem[];
  contextMenu: PersonalContextMenuState | null;
  meetingItems: MeetingItem[];
  noticeItems: Announcement[];
  recentItems: RecentWorkItem[];
  onAdvanceMeeting: (id: string) => void;
  onClose: () => void;
  onCreateApproval: () => void;
  onEditProfile: () => void;
  onFocusPendingApprovals: () => void;
  onMarkAllNoticesRead: () => void;
  onMarkNoticeRead: (id: string) => void;
  onOpenModule: (moduleId?: ModuleId) => void;
  onProcessApproval: (id: string, status: "approved" | "returned") => void;
  onRefreshRecentWork: () => void;
  onSelectApproval: (item: ApprovalItem) => void;
  onSyncCalendar: () => void;
  onSyncLiveQueues: () => void;
}) {
  if (!contextMenu) return null;

  const approval =
    contextMenu.kind === "approval"
      ? approvalItems.find((item) => item.id === contextMenu.itemId)
      : null;
  const notice =
    contextMenu.kind === "notice"
      ? noticeItems.find((item) => item.id === contextMenu.itemId)
      : null;
  const noticeApproval = notice?.approvalId
    ? approvalItems.find((item) => item.id === notice.approvalId)
    : null;
  const meeting =
    contextMenu.kind === "meeting"
      ? meetingItems.find((item) => item.id === contextMenu.itemId)
      : null;
  const recent =
    contextMenu.kind === "recent"
      ? recentItems.find((item) => item.id === contextMenu.itemId)
      : null;

  function run(action: () => void) {
    action();
    onClose();
  }

  const title =
    contextMenu.kind === "approval"
      ? "审批操作"
      : contextMenu.kind === "notice"
        ? "通知操作"
        : contextMenu.kind === "meeting"
          ? "会议操作"
          : contextMenu.kind === "recent"
            ? "最近工作"
            : contextMenu.kind === "profile"
              ? "个人资料"
              : "个人中心";

  return (
    <div
      aria-label={title}
      className="fixed z-[9999] w-[228px] overflow-hidden rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] py-1 text-xs text-[var(--arch-text)] shadow-xl"
      role="menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="border-b border-[var(--arch-border)] px-3 py-1.5 font-medium text-[var(--arch-text-muted)]">
        {title}
      </div>

      {approval ? (
        <>
          <PersonalContextMenuButton
            label="选中审批"
            shortcut="Click"
            onClick={() => run(() => onSelectApproval(approval))}
          />
          <PersonalContextMenuButton
            label="打开来源模块"
            shortcut="Enter"
            onClick={() =>
              run(() => {
                onSelectApproval(approval);
                onOpenModule(approval.moduleId);
              })
            }
          />
          <ContextMenuDivider />
          <PersonalContextMenuButton
            disabled={isApprovalClosed(approval)}
            label="通过"
            onClick={() =>
              run(() => {
                onSelectApproval(approval);
                onProcessApproval(approval.id, "approved");
              })
            }
          />
          <PersonalContextMenuButton
            danger
            disabled={isApprovalClosed(approval)}
            label="退回"
            onClick={() =>
              run(() => {
                onSelectApproval(approval);
                onProcessApproval(approval.id, "returned");
              })
            }
          />
          <ContextMenuDivider />
        </>
      ) : null}

      {notice ? (
        <>
          <PersonalContextMenuButton
            disabled={!noticeApproval}
            label="打开对应审批"
            onClick={() =>
              run(() => {
                if (noticeApproval) onSelectApproval(noticeApproval);
              })
            }
          />
          <PersonalContextMenuButton
            disabled={notice.read}
            label="标为已读"
            onClick={() => run(() => onMarkNoticeRead(notice.id))}
          />
          <PersonalContextMenuButton
            label="全部已读"
            onClick={() => run(onMarkAllNoticesRead)}
          />
          <ContextMenuDivider />
        </>
      ) : null}

      {meeting ? (
        <>
          <PersonalContextMenuButton
            label="打开来源模块"
            onClick={() => run(() => onOpenModule(meeting.moduleId))}
          />
          <PersonalContextMenuButton
            disabled={meeting.status === "done"}
            label={meeting.status === "upcoming" ? "签到" : "完成"}
            onClick={() => run(() => onAdvanceMeeting(meeting.id))}
          />
          <PersonalContextMenuButton
            label="同步日历"
            onClick={() => run(onSyncCalendar)}
          />
          <ContextMenuDivider />
        </>
      ) : null}

      {recent ? (
        <>
          <PersonalContextMenuButton
            disabled={!recent.moduleId}
            label="打开来源模块"
            onClick={() => run(() => onOpenModule(recent.moduleId))}
          />
          <PersonalContextMenuButton
            label="刷新最近工作"
            onClick={() => run(onRefreshRecentWork)}
          />
          <ContextMenuDivider />
        </>
      ) : null}

      {contextMenu.kind === "profile" ? (
        <>
          <PersonalContextMenuButton
            label="编辑个人资料"
            onClick={() => run(onEditProfile)}
          />
          <ContextMenuDivider />
        </>
      ) : null}

      <PersonalContextMenuButton
        label="新建审批"
        onClick={() => run(onCreateApproval)}
      />
      <PersonalContextMenuButton
        label="定位待处理审批"
        onClick={() => run(onFocusPendingApprovals)}
      />
      <PersonalContextMenuButton
        label="刷新动态队列"
        shortcut="F5"
        onClick={() => run(onSyncLiveQueues)}
      />
      <PersonalContextMenuButton
        label="关闭菜单"
        shortcut="Esc"
        onClick={onClose}
      />
    </div>
  );
}

function ContextMenuDivider() {
  return <div className="my-1 border-t border-[var(--arch-border)]" />;
}

function PersonalContextMenuButton({
  danger,
  disabled,
  label,
  shortcut,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      role="menuitem"
      className={[
        "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition",
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : "hover:bg-[var(--arch-surface-muted)]",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
      onClick={onClick}
    >
      <span className="min-w-0 truncate">{label}</span>
      {shortcut ? (
        <span className="shrink-0 font-mono text-[10px] text-[var(--arch-text-muted)]">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[54px] border-l border-[#e8eaed] pl-3 first:border-l-0 first:pl-0">
      <div className="text-sm font-semibold leading-4 text-[#202124]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-3 text-[#5f6368]">{label}</div>
    </div>
  );
}

function QueueStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-[#e8eaed] px-2 py-2 last:border-r-0">
      <div className="font-semibold text-[#202124]">{value}</div>
      <div className="mt-0.5 text-[#5f6368]">{label}</div>
    </div>
  );
}

function CreateApprovalPanel({
  approverOptions,
  draft,
  moduleOptions,
  onCancel,
  onChange,
  onSubmit,
}: {
  approverOptions: Array<{ label: string; value: string }>;
  draft: ApprovalDraft;
  moduleOptions: Array<{ label: string; value: ModuleId }>;
  onCancel: () => void;
  onChange: (draft: ApprovalDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="grid gap-2 border-b border-[#e8eaed] bg-[#f8fafd] p-3"
      aria-label="新建审批"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2">
        <label className="grid gap-1 text-[11px] font-medium text-[#5f6368]">
          来源模块
          <Select<ModuleId>
            aria-label="审批来源模块"
            options={moduleOptions}
            size="small"
            value={draft.moduleId}
            onChange={(moduleId) => onChange({ ...draft, moduleId })}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-medium text-[#5f6368]">
          审批事项
          <Input
            aria-label="审批事项名称"
            placeholder="输入真实审批事项名称"
            size="small"
            value={draft.title}
            onChange={(event) =>
              onChange({ ...draft, title: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1 text-[11px] font-medium text-[#5f6368]">
          审批人
          <Select<string>
            aria-label="审批人"
            options={approverOptions}
            size="small"
            value={draft.approver}
            onChange={(approver) => onChange({ ...draft, approver })}
          />
        </label>
      </div>
      <div className="flex justify-end gap-1">
        <Button size="small" onClick={onCancel}>
          取消
        </Button>
        <Button htmlType="submit" size="small" type="primary">
          提交审批
        </Button>
      </div>
    </form>
  );
}

function ApprovalQueueEmpty({
  creatingApproval,
  identitySearchHits,
  searchQuery,
  onClearSearch,
  onCreateApproval,
}: {
  creatingApproval: boolean;
  identitySearchHits: IdentityPersonSearchHit[];
  searchQuery: string;
  onClearSearch: () => void;
  onCreateApproval: () => void;
}) {
  const normalizedQuery = searchQuery.trim();
  const hasSearch = normalizedQuery.length > 0;
  const description = hasSearch
    ? identitySearchHits.length > 0
      ? `人员目录命中 ${identitySearchHits.map((person) => person.name).join("、")}，但没有关联审批。`
      : `没有找到“${normalizedQuery}”关联的真实审批。`
    : "暂无真实待审批事项";

  return (
    <div className="m-3 grid gap-2">
      <Empty
        className="py-5 text-xs"
        description={
          <span className="grid gap-1">
            <span>{description}</span>
            <span className="text-[11px]">
              搜索支持审批名称、模块、发起人、审批人和设置中心人员目录。
            </span>
          </span>
        }
      />
      {identitySearchHits.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-[#e8eaed] bg-white">
          {identitySearchHits.slice(0, 3).map((person) => (
            <div
              key={person.id}
              className="border-b border-[#edf0f2] px-3 py-2 text-xs last:border-b-0"
            >
              <div className="truncate font-medium text-[#202124]">
                {person.name}
              </div>
              <div className="truncate font-mono text-[11px] text-[#5f6368]">
                {person.account} · {person.email || "未登记邮箱"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {hasSearch ? (
          <Button size="small" onClick={onClearSearch}>
            清空搜索
          </Button>
        ) : null}
        {!creatingApproval ? (
          <Button
            block
            icon={<Plus className="h-3.5 w-3.5" />}
            size="small"
            type="primary"
            onClick={onCreateApproval}
          >
            新建审批
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ApprovalQueueRow({
  item,
  active,
  onContextMenu,
  onSelect,
}: {
  item: ApprovalItem;
  active: boolean;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onSelect: () => void;
}) {
  return (
    <tr
      aria-pressed={active}
      className={[
        "group/approval cursor-pointer border-b border-[#edf0f2] transition last:border-b-0",
        active ? "bg-[#e8f0fe]" : "bg-white hover:bg-[#f8fafd]",
      ].join(" ")}
      tabIndex={0}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <td className="min-w-0 px-3 py-2.5 align-top">
        <div className="truncate text-sm font-medium leading-5 text-[#202124]">
          {item.title}
        </div>
        <div className="truncate text-[11px] leading-4 text-[#5f6368]">
          {item.module} · {item.currentStep}
        </div>
        <div className="truncate text-[11px] leading-4 text-[#80868b]">
          发起 {item.requester}
        </div>
      </td>
      <td className="px-2 py-2.5 align-top">
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${statusClassNames[item.status]}`}
        >
          {statusLabels[item.status]}
        </span>
      </td>
      <td className="px-2 py-2.5 align-top font-mono text-[11px] text-[#5f6368]">
        <div className="truncate">{item.updatedAt}</div>
        <div className="mt-0.5 truncate">审 {item.approver}</div>
      </td>
      <td className="px-2 py-2.5 text-right align-top">
        <button
          type="button"
          title="更多操作"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#5f6368] opacity-70 transition hover:bg-[#e8eaed] hover:text-[#202124] group-hover/approval:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onContextMenu(event);
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function ApprovalInspector({
  identitySearchHits,
  item,
  searchQuery,
  totalApprovalCount,
  visibleApprovalCount,
  onClearSearch,
  onContextMenu,
  onApprove,
  onCreateApproval,
  onOpen,
  onRefresh,
  onReturn,
}: {
  identitySearchHits: IdentityPersonSearchHit[];
  item: ApprovalItem | null;
  searchQuery: string;
  totalApprovalCount: number;
  visibleApprovalCount: number;
  onClearSearch: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onApprove: (id: string) => void;
  onCreateApproval: () => void;
  onOpen: (moduleId: ModuleId) => void;
  onRefresh: () => void;
  onReturn: (id: string) => void;
}) {
  if (!item) {
    return (
      <section
        className="flex min-h-[300px] min-w-0 flex-col overflow-hidden border-r border-[#e8eaed] bg-white"
        onContextMenu={onContextMenu}
      >
        <div className="flex items-center gap-2 border-b border-[#e8eaed] px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-[color:var(--module-accent)]" />
          <h3 className="text-sm font-medium text-[#202124]">审批详情</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <ApprovalInspectorEmpty
            identitySearchHits={identitySearchHits}
            searchQuery={searchQuery}
            totalApprovalCount={totalApprovalCount}
            visibleApprovalCount={visibleApprovalCount}
            onClearSearch={onClearSearch}
            onCreateApproval={onCreateApproval}
            onRefresh={onRefresh}
          />
        </div>
      </section>
    );
  }

  const closed = isApprovalClosed(item);

  return (
    <section
      className="flex min-h-[300px] min-w-0 flex-col overflow-hidden border-r border-[#e8eaed] bg-white"
      onContextMenu={onContextMenu}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8eaed] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--module-accent)]" />
            <h3 className="text-sm font-medium text-[#202124]">审批详情</h3>
            <Tag color={statusTagColors[item.status]}>
              {statusLabels[item.status]}
            </Tag>
          </div>
          <div className="mt-1 truncate text-[15px] font-medium leading-5 text-[#202124]">
            {item.title}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Button
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            size="small"
            onClick={() => onOpen(item.moduleId)}
          >
            打开
          </Button>
          <Button
            danger
            disabled={closed}
            size="small"
            onClick={() => onReturn(item.id)}
          >
            退回
          </Button>
          <Button
            disabled={closed}
            size="small"
            type="primary"
            onClick={() => onApprove(item.id)}
          >
            通过
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="grid gap-x-5 gap-y-3 lg:grid-cols-4">
          <InspectorField label="模块" value={item.module} />
          <InspectorField label="当前环节" value={item.currentStep} />
          <InspectorField label="发起人" value={item.requester} />
          <InspectorField label="审批人" value={item.approver} />
          <InspectorField label="发起时间" value={item.createdAt} />
          <InspectorField label="最后更新" value={item.updatedAt} />
          <InspectorField
            label="关联文件"
            value={`${item.relatedFileCount} 个`}
          />
          <InspectorField
            label="关联交付物"
            value={`${item.relatedArtifactCount} 个`}
          />
        </div>

        <div className="mt-4 border-t border-[#e8eaed] pt-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#5f6368]">
            <ListChecks className="h-3.5 w-3.5" />
            全流程
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.process.map((step) => (
              <ProcessPill key={step.id} step={step} />
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-[#e8eaed] pt-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#5f6368]">
            <History className="h-3.5 w-3.5" />
            已经过的流程与时间
          </div>
          <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid overflow-hidden rounded-md border border-[#e8eaed]">
              {item.history.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[92px_116px_minmax(0,1fr)] gap-2 border-b border-[#edf0f2] px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="font-mono text-[#5f6368]">{event.at}</span>
                  <span className="truncate text-[#5f6368]">{event.actor}</span>
                  <span className="truncate text-[#202124]">
                    {event.summary}
                  </span>
                </div>
              ))}
            </div>
            <DecisionChecklist item={item} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ApprovalInspectorEmpty({
  identitySearchHits,
  searchQuery,
  totalApprovalCount,
  visibleApprovalCount,
  onClearSearch,
  onCreateApproval,
  onRefresh,
}: {
  identitySearchHits: IdentityPersonSearchHit[];
  searchQuery: string;
  totalApprovalCount: number;
  visibleApprovalCount: number;
  onClearSearch: () => void;
  onCreateApproval: () => void;
  onRefresh: () => void;
}) {
  const normalizedQuery = searchQuery.trim();
  const hasSearch = normalizedQuery.length > 0;
  const title = hasSearch
    ? visibleApprovalCount === 0
      ? "没有匹配的审批"
      : "请选择一个审批事项"
    : totalApprovalCount === 0
      ? "暂无真实审批事务"
      : "请选择一个审批事项";
  const description = hasSearch
    ? identitySearchHits.length > 0
      ? `人员目录命中 ${identitySearchHits.map((person) => person.name).join("、")}，但当前筛选范围内没有关联审批。`
      : `没有找到包含“${normalizedQuery}”的审批、模块、发起人或审批人。`
    : totalApprovalCount === 0
      ? "个人中心不会再填充默认生命周期事务；创建审批或从 CDE/后端同步真实事务后才会显示。"
      : "左侧队列中选择一条审批后，这里显示流程、关联文件、历史和处理核对。";

  return (
    <div className="grid h-full min-h-[420px] content-start gap-4 p-1">
      <div className="rounded-lg border border-[#e8eaed] bg-[#fafafa] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[260px] flex-1 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f0fe] text-[#1967d2]">
              <ListChecks className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-[#202124]">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#5f6368]">
                {description}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {hasSearch ? (
              <Button size="small" onClick={onClearSearch}>
                清空搜索
              </Button>
            ) : null}
            <Button size="small" onClick={onRefresh}>
              刷新真实队列
            </Button>
            <Button
              icon={<Plus className="h-3.5 w-3.5" />}
              size="small"
              type="primary"
              onClick={onCreateApproval}
            >
              新建审批
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <EmptyMetric label="真实审批事务" value={totalApprovalCount} />
          <EmptyMetric label="当前筛选命中" value={visibleApprovalCount} />
          <EmptyMetric label="人员目录命中" value={identitySearchHits.length} />
        </div>
      </div>

      {identitySearchHits.length > 0 ? (
        <div className="rounded-lg border border-[#e8eaed] bg-white">
          <div className="border-b border-[#e8eaed] px-4 py-2 text-xs font-medium text-[#202124]">
            设置中心人员目录
          </div>
          {identitySearchHits.map((person) => (
            <div
              key={person.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-[#edf0f2] px-3 py-2 text-xs last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-[#202124]">
                  {person.name}
                </span>
                <span className="block truncate text-[#5f6368]">
                  {person.account} · {person.email}
                </span>
              </span>
              <span className="self-center rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[#5f6368]">
                人员目录
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-dashed border-[#dadce0] bg-white p-4 text-sm leading-6 text-[#5f6368]">
        这里展示审批详情、流程、关联文件和处理核对。当前没有可展示的审批时，先从左侧选择真实审批，或者新建一个事务进入待审批队列。
      </div>
    </div>
  );
}

function EmptyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#e8eaed] bg-white px-3 py-2">
      <div className="text-lg font-semibold leading-5 text-[#202124]">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[#5f6368]">{label}</div>
    </div>
  );
}

function DecisionChecklist({ item }: { item: ApprovalItem }) {
  const closed = isApprovalClosed(item);
  const rows = [
    {
      label: "当前动作",
      value: closed ? "查看已处理记录" : "核对后通过或退回",
    },
    {
      label: "关联范围",
      value: `${item.relatedFileCount} 个文件 / ${item.relatedArtifactCount} 个交付物`,
    },
    {
      label: "审批边界",
      value: "缺少专业或监管来源时只记录经验建议",
    },
    {
      label: "来源模块",
      value: item.module,
    },
  ];

  return (
    <div className="rounded-md border border-[#e8eaed] bg-[#fafafa]">
      <div className="flex items-center gap-2 border-b border-[#e8eaed] px-3 py-2 text-xs font-medium text-[#202124]">
        <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--module-accent)]" />
        处理核对
      </div>
      <div className="grid">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[76px_minmax(0,1fr)] gap-2 border-b border-[#edf0f2] px-3 py-2 text-xs last:border-b-0"
          >
            <span className="text-[#5f6368]">{row.label}</span>
            <span className="truncate text-[#202124]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-[#edf0f2] pb-2">
      <div className="text-[11px] text-[#5f6368]">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium text-[#202124]">
        {value}
      </div>
    </div>
  );
}

function ProcessPill({ step }: { step: ApprovalProcessStep }) {
  const className =
    step.state === "current"
      ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1967d2]"
      : step.state === "done"
        ? "border-[#dadce0] bg-white text-[#3c4043]"
        : "border-[#e8eaed] bg-[#f8fafd] text-[#80868b]";
  const title = [step.label, step.actor, step.at, step.summary]
    .filter(Boolean)
    .join(" / ");
  return (
    <span
      title={title}
      className={`rounded-full border px-2.5 py-1 text-[11px] ${className}`}
    >
      {step.label}
      {step.at ? ` · ${step.at}` : ""}
    </span>
  );
}

function ContextRail({
  meetingItems,
  noticeItems,
  recentItems,
  onAdvanceMeeting,
  onMarkAllNoticesRead,
  onMarkNoticeRead,
  onOpenModule,
  onRefreshRecentWork,
  onSelectApprovalById,
  onSyncCalendar,
  onOpenContextMenu,
}: {
  meetingItems: MeetingItem[];
  noticeItems: Announcement[];
  recentItems: RecentWorkItem[];
  onAdvanceMeeting: (id: string) => void;
  onMarkAllNoticesRead: () => void;
  onMarkNoticeRead: (id: string) => void;
  onOpenModule: (moduleId?: ModuleId) => void;
  onRefreshRecentWork: () => void;
  onSelectApprovalById: (id: string) => void;
  onSyncCalendar: () => void;
  onOpenContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    target: PersonalContextMenuTarget,
  ) => void;
}) {
  const unreadNoticeCount = noticeItems.filter((item) => !item.read).length;
  return (
    <aside className="flex min-h-[300px] min-w-0 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-auto">
        <ContextSection
          action={
            <Button
              disabled={unreadNoticeCount === 0}
              size="small"
              onClick={onMarkAllNoticesRead}
            >
              全部已读
            </Button>
          }
          icon={<Bell className="h-4 w-4 text-[color:var(--module-accent)]" />}
          title="公告通知"
        >
          {noticeItems.length > 0 ? (
            noticeItems.map((item) => (
              <NoticeLine
                key={item.id}
                item={item}
                onContextMenu={(event) =>
                  onOpenContextMenu(event, {
                    kind: "notice",
                    itemId: item.id,
                  })
                }
                onRead={() => onMarkNoticeRead(item.id)}
                onSelectApproval={
                  item.approvalId
                    ? () => onSelectApprovalById(item.approvalId!)
                    : undefined
                }
              />
            ))
          ) : (
            <ContextEmpty>暂无真实通知或后端审计事件</ContextEmpty>
          )}
        </ContextSection>

        <ContextSection
          action={
            <Button
              disabled={meetingItems.length === 0}
              size="small"
              onClick={onSyncCalendar}
            >
              同步日历
            </Button>
          }
          icon={
            <CalendarDays className="h-4 w-4 text-[color:var(--module-accent)]" />
          }
          title="会议日程"
        >
          {meetingItems.length > 0 ? (
            meetingItems.map((item) => (
              <MeetingLine
                key={item.id}
                item={item}
                onAdvance={() => onAdvanceMeeting(item.id)}
                onContextMenu={(event) =>
                  onOpenContextMenu(event, {
                    kind: "meeting",
                    itemId: item.id,
                  })
                }
                onOpen={() => onOpenModule(item.moduleId)}
              />
            ))
          ) : (
            <ContextEmpty>未接入真实日历/会议来源</ContextEmpty>
          )}
        </ContextSection>

        <ContextSection
          action={
            <Button size="small" onClick={onRefreshRecentWork}>
              刷新
            </Button>
          }
          icon={
            <FileText className="h-4 w-4 text-[color:var(--module-accent)]" />
          }
          title="最近工作"
        >
          {recentItems.length > 0 ? (
            recentItems.map((item) => (
              <RecentLine
                key={item.id}
                item={item}
                onContextMenu={(event) =>
                  onOpenContextMenu(event, {
                    kind: "recent",
                    itemId: item.id,
                  })
                }
                onOpen={() => onOpenModule(item.moduleId)}
              />
            ))
          ) : (
            <ContextEmpty>暂无真实操作记录</ContextEmpty>
          )}
        </ContextSection>
      </div>
    </aside>
  );
}

function ContextSection({
  action,
  children,
  icon,
  title,
}: {
  action: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="border-b border-[#e8eaed] last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h3 className="truncate text-sm font-medium text-[#202124]">
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="border-t border-[#e8eaed]">{children}</div>
    </section>
  );
}

function ContextEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-5 text-center text-xs text-[#80868b]">
      {children}
    </div>
  );
}

function NoticeLine({
  item,
  onContextMenu,
  onRead,
  onSelectApproval,
}: {
  item: Announcement;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onRead: () => void;
  onSelectApproval?: (() => void) | undefined;
}) {
  const levelClassName =
    item.level === "important"
      ? "bg-rose-50 text-rose-600"
      : item.level === "system"
        ? "bg-blue-50 text-blue-600"
        : "bg-[color:var(--module-accent-soft)] text-[color:var(--module-accent)]";
  return (
    <div
      role={onSelectApproval ? "button" : undefined}
      tabIndex={onSelectApproval ? 0 : undefined}
      className={[
        "grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#edf0f2] px-4 py-2.5 last:border-b-0",
        item.read ? "opacity-70" : "bg-[#e8f0fe]",
        onSelectApproval ? "cursor-pointer hover:bg-[#dfeaff]" : "",
      ].join(" ")}
      title={onSelectApproval ? "打开对应审批" : undefined}
      onClick={onSelectApproval}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (!onSelectApproval) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectApproval();
        }
      }}
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded ${levelClassName}`}
      >
        <MailCheck className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-[var(--arch-text)]">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[#5f6368]">
          {item.scope} · {item.time}
        </span>
      </span>
      <span className="flex justify-end gap-1">
        {onSelectApproval ? (
          <Button
            icon={<ExternalLink className="h-3 w-3" />}
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onSelectApproval();
            }}
          >
            打开
          </Button>
        ) : null}
        <Button
          disabled={item.read}
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onRead();
          }}
        >
          {item.read ? "已读" : "标为已读"}
        </Button>
      </span>
    </div>
  );
}

function MeetingLine({
  item,
  onAdvance,
  onContextMenu,
  onOpen,
}: {
  item: MeetingItem;
  onAdvance: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
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
      className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#edf0f2] px-4 py-2.5 last:border-b-0"
      onContextMenu={onContextMenu}
    >
      <span className="font-mono text-xs font-semibold text-[color:var(--module-accent)]">
        {item.time}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-[var(--arch-text)]">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[#5f6368]">
          {item.location} · {item.owner} · {meetingStatusLabels[item.status]}
        </span>
      </span>
      <span className="flex justify-end gap-1">
        <Button
          icon={<ExternalLink className="h-3 w-3" />}
          size="small"
          onClick={onOpen}
        >
          打开
        </Button>
        <Button
          disabled={item.status === "done"}
          size="small"
          type="primary"
          onClick={onAdvance}
        >
          {actionLabel}
        </Button>
      </span>
    </div>
  );
}

function RecentLine({
  item,
  onContextMenu,
  onOpen,
}: {
  item: RecentWorkItem;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#edf0f2] px-4 py-2.5 last:border-b-0"
      onContextMenu={onContextMenu}
    >
      <span className="truncate text-xs font-medium text-[color:var(--module-accent)]">
        {item.module}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-[var(--arch-text)]">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[#5f6368]">
          {item.time}
        </span>
      </span>
      <Button
        disabled={!item.moduleId}
        icon={<ExternalLink className="h-3 w-3" />}
        size="small"
        onClick={onOpen}
      >
        打开
      </Button>
    </div>
  );
}

function AccountButton({
  open,
  profile,
  onClick,
  onContextMenu,
}: {
  open: boolean;
  profile: PersonalProfile;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="账号资料"
      aria-expanded={open}
      aria-haspopup="dialog"
      className={[
        "grid h-10 w-10 place-items-center rounded-full border text-sm font-semibold transition",
        open
          ? "border-[#d2e3fc] bg-[#e8f0fe] text-[#1967d2] shadow-sm"
          : "border-transparent bg-[#f1f3f4] text-[#1967d2] hover:bg-[#e8eaed]",
      ].join(" ")}
      title={`${profile.name} · ${profile.role}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {profile.name.slice(0, 1).toUpperCase()}
    </button>
  );
}

function AccountPanel({
  profile,
  draft,
  editing,
  onCancel,
  onEdit,
  onSave,
  onDraftChange,
}: {
  profile: PersonalProfile;
  draft: PersonalProfile;
  editing: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => void;
  onDraftChange: (draft: PersonalProfile) => void;
}) {
  return (
    <div
      aria-label="个人资料"
      className="absolute right-0 top-12 z-[9998] w-[344px] overflow-hidden rounded-lg border border-[#dadce0] bg-white text-xs shadow-[0_8px_24px_rgba(60,64,67,0.22)]"
      role="dialog"
    >
      <div className="px-5 pb-4 pt-5 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#1a73e8] text-xl font-medium text-white">
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="mt-3 truncate text-base font-medium text-[#202124]">
          {profile.name}
        </div>
        <div className="mt-0.5 truncate text-sm text-[#5f6368]">
          {profile.email}
        </div>
        <div className="mt-1 truncate text-xs text-[#5f6368]">
          {profile.role}
        </div>
      </div>

      {editing ? (
        <div className="grid gap-2 border-t border-[#e8eaed] px-4 py-3">
          <label className="grid gap-1 text-left text-[11px] text-[#5f6368]">
            名称
            <Input
              size="small"
              value={draft.name}
              onChange={(event) =>
                onDraftChange({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-left text-[11px] text-[#5f6368]">
            角色
            <Input
              size="small"
              value={draft.role}
              onChange={(event) =>
                onDraftChange({ ...draft, role: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-left text-[11px] text-[#5f6368]">
            邮箱
            <Input
              size="small"
              value={draft.email}
              onChange={(event) =>
                onDraftChange({ ...draft, email: event.target.value })
              }
            />
          </label>
        </div>
      ) : (
        <div className="border-t border-[#e8eaed] px-4 py-3 text-center">
          <button
            type="button"
            className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-medium text-[#1a73e8] transition hover:bg-[#f8fafd]"
            onClick={onEdit}
          >
            管理个人资料
          </button>
        </div>
      )}

      <div className="grid gap-2 border-t border-[#e8eaed] px-4 py-3">
        <ProfileLine
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="安全"
          value={profile.security}
        />
        <ProfileLine
          icon={<Clock3 className="h-3.5 w-3.5" />}
          label="最近登录"
          value={profile.login}
        />
      </div>

      <div className="flex justify-end gap-1 border-t border-[#e8eaed] bg-[#fafafa] px-4 py-3">
        <Button size="small" onClick={onCancel}>
          {editing ? "取消" : "关闭"}
        </Button>
        {editing ? (
          <Button size="small" type="primary" onClick={onSave}>
            保存
          </Button>
        ) : null}
      </div>
    </div>
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
      <span className="text-[color:var(--module-accent)]">{icon}</span>
      <span className="w-14 shrink-0 text-[#5f6368]">{label}</span>
      <span className="min-w-0 truncate text-[#202124]">{value}</span>
    </div>
  );
}

// components/SettingsCenterIamPanel.tsx
// License: Apache-2.0
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Database,
  ImageIcon,
  KeyRound,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { SettingsCenterDatabasePanel } from "@/components/SettingsCenterDatabasePanel";
import { SettingsCenterOpsPanel } from "@/components/SettingsCenterOpsPanel";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";

type AccountStatus = "active" | "locked" | "disabled";
type DirectoryView = "people" | "units" | "positions" | "permissions";
type SettingsConsoleView = "overview" | "identity" | "database" | "ops";
type PositionMoveDirection = "top" | "up" | "down" | "bottom";
type IdentityCreateOptions = { afterPositionId?: string };
type IdentityRegistrySnapshot = {
  people: SettingsPersonAccount[];
  units: SettingsOrgUnit[];
  positions: SettingsPosition[];
};

type SettingsOrgUnit = {
  id: string;
  name: string;
  code: string;
  parentId?: string;
};

type SettingsPosition = {
  id: string;
  name: string;
  code: string;
  unitId: string;
  level: string;
};

type SettingsRole = {
  roleKey: string;
  name: string;
};

type SettingsPersonAccount = {
  id: string;
  fullName: string;
  accountName: string;
  email: string;
  phone: string;
  companyName: string;
  unitId: string;
  positionId: string;
  roleKey: string;
  avatarLabel: string;
  avatarColor: string;
  avatarImageUrl?: string;
  status: AccountStatus;
  passwordUpdatedAt: string;
  updatedAt: string;
};

type DialogState =
  | { kind: "person"; mode: "create" | "edit"; id?: string }
  | { kind: "unit"; mode: "create" | "edit"; id?: string }
  | { kind: "position"; mode: "create" | "edit"; id?: string };

type IdentityContextMenuState =
  | { kind: "person"; personId: string; x: number; y: number }
  | { kind: "unit"; unitId: string; x: number; y: number }
  | { kind: "position"; positionId: string; x: number; y: number }
  | { kind: "background"; view: DirectoryView; x: number; y: number };

type AvatarIdentity = {
  label: string;
  color: string;
  accentColor: string;
  kind: AvatarKind;
};

type AvatarKind =
  | "pikachu"
  | "strawberry_bear"
  | "duck"
  | "mouse"
  | "cat"
  | "generic";

const semanticAvatarProfiles = [
  {
    keywords: ["皮卡丘", "pikachu"],
    label: "皮",
    color: "#facc15",
    accentColor: "#ef4444",
    kind: "pikachu",
  },
  {
    keywords: ["草莓熊", "strawberry", "bear"],
    label: "莓",
    color: "#f43f5e",
    accentColor: "#fbbf24",
    kind: "strawberry_bear",
  },
  {
    keywords: ["唐老鸭", "donald", "duck"],
    label: "唐",
    color: "#2563eb",
    accentColor: "#facc15",
    kind: "duck",
  },
  {
    keywords: ["米老鼠", "mickey", "mouse"],
    label: "米",
    color: "#111827",
    accentColor: "#ef4444",
    kind: "mouse",
  },
  {
    keywords: ["汤姆猫", "tom", "cat"],
    label: "汤",
    color: "#64748b",
    accentColor: "#38bdf8",
    kind: "cat",
  },
] satisfies Array<{
  keywords: string[];
  label: string;
  color: string;
  accentColor: string;
  kind: AvatarKind;
}>;

const statusLabels: Record<AccountStatus, string> = {
  active: "启用",
  locked: "锁定",
  disabled: "停用",
};

const statusClassNames: Record<AccountStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  locked: "border-amber-200 bg-amber-50 text-amber-700",
  disabled: "border-slate-200 bg-slate-50 text-slate-500",
};

const identityRegistryStorageKey = "architoken.settings.identityRegistry.v1";

const initialUnits: SettingsOrgUnit[] = [
  { id: "unit-management", name: "经营管理部", code: "ORG-MGT" },
  { id: "unit-design", name: "方案设计部", code: "ORG-SOL" },
  { id: "unit-product", name: "产品研发部", code: "ORG-RND" },
  { id: "unit-aigc", name: "AIGC研发部", code: "ORG-AIGC" },
  { id: "unit-project", name: "项目交付部", code: "ORG-PMO" },
  { id: "unit-finance", name: "财务管理部", code: "ORG-FIN" },
  { id: "unit-hr", name: "人力资源部", code: "ORG-HR" },
];

const initialPositions: SettingsPosition[] = [
  {
    id: "pos-chairman",
    name: "董事长",
    code: "P-CHAIR",
    unitId: "unit-management",
    level: "L1",
  },
  {
    id: "pos-general-manager",
    name: "CEO",
    code: "CEO",
    unitId: "unit-management",
    level: "L1",
  },
  {
    id: "pos-chief-technology-officer",
    name: "首席技术官",
    code: "CTO",
    unitId: "unit-aigc",
    level: "L1",
  },
  {
    id: "pos-software-engineer",
    name: "软件工程师",
    code: "SWE",
    unitId: "unit-aigc",
    level: "L3",
  },
  {
    id: "pos-finance-director",
    name: "财务总监",
    code: "P-FD",
    unitId: "unit-finance",
    level: "L2",
  },
  {
    id: "pos-admin-director",
    name: "行政总监",
    code: "P-AD",
    unitId: "unit-management",
    level: "L2",
  },
  {
    id: "pos-marketing-director",
    name: "市场总监",
    code: "P-MD",
    unitId: "unit-management",
    level: "L2",
  },
  {
    id: "pos-delivery-director",
    name: "交付总监",
    code: "P-DD",
    unitId: "unit-project",
    level: "L2",
  },
  {
    id: "pos-product-director",
    name: "产品总监",
    code: "P-PD",
    unitId: "unit-product",
    level: "L2",
  },
  {
    id: "pos-design-director",
    name: "设计总监",
    code: "P-DESD",
    unitId: "unit-design",
    level: "L2",
  },
  {
    id: "pos-project-manager",
    name: "项目经理",
    code: "P-PM",
    unitId: "unit-project",
    level: "L2",
  },
  {
    id: "pos-production-manager",
    name: "生产经理",
    code: "P-PROD",
    unitId: "unit-project",
    level: "L2",
  },
  {
    id: "pos-quality-manager",
    name: "质量经理",
    code: "P-QA",
    unitId: "unit-project",
    level: "L2",
  },
  {
    id: "pos-concept-designer",
    name: "方案设计师",
    code: "P-CD",
    unitId: "unit-design",
    level: "L3",
  },
  {
    id: "pos-detailed-designer",
    name: "深化设计师",
    code: "P-DDES",
    unitId: "unit-design",
    level: "L3",
  },
  {
    id: "pos-process-engineer",
    name: "工艺工程师",
    code: "P-PE",
    unitId: "unit-product",
    level: "L3",
  },
  {
    id: "pos-cost-engineer",
    name: "造价工程师",
    code: "P-CE",
    unitId: "unit-project",
    level: "L3",
  },
  {
    id: "pos-safety-engineer",
    name: "安全工程师",
    code: "P-SE",
    unitId: "unit-project",
    level: "L3",
  },
  {
    id: "pos-supervision-engineer",
    name: "监理工程师",
    code: "P-SUP",
    unitId: "unit-project",
    level: "L3",
  },
  {
    id: "pos-material-engineer",
    name: "材料工程师",
    code: "P-ME",
    unitId: "unit-project",
    level: "L3",
  },
];

const roleTemplates: SettingsRole[] = [
  {
    roleKey: "administrator",
    name: "管理员",
  },
  {
    roleKey: "read_write",
    name: "可读写",
  },
  {
    roleKey: "delete_protected",
    name: "防删除",
  },
  {
    roleKey: "read_only",
    name: "只可读",
  },
  {
    roleKey: "no_access",
    name: "不可读",
  },
];

const initialPeople: SettingsPersonAccount[] = [
  {
    id: "person-pikachu",
    fullName: "皮卡丘",
    accountName: "pikachu",
    email: "pikachu@architoken.local",
    phone: "13800001001",
    companyName: "ArchIToken",
    unitId: "unit-management",
    positionId: "pos-chairman",
    roleKey: "administrator",
    avatarLabel: resolveAvatarIdentity("皮卡丘", "pikachu").label,
    avatarColor: resolveAvatarIdentity("皮卡丘", "pikachu").color,
    status: "active",
    passwordUpdatedAt: "2026-05-20",
    updatedAt: "2026-05-28",
  },
  {
    id: "person-strawberry-bear",
    fullName: "草莓熊",
    accountName: "strawberry.bear",
    email: "strawberry.bear@architoken.local",
    phone: "13800001002",
    companyName: "ArchIToken",
    unitId: "unit-project",
    positionId: "pos-project-manager",
    roleKey: "read_write",
    avatarLabel: resolveAvatarIdentity("草莓熊", "strawberry.bear").label,
    avatarColor: resolveAvatarIdentity("草莓熊", "strawberry.bear").color,
    status: "active",
    passwordUpdatedAt: "2026-05-18",
    updatedAt: "2026-05-28",
  },
  {
    id: "person-donald-duck",
    fullName: "唐老鸭",
    accountName: "donald.duck",
    email: "donald.duck@architoken.local",
    phone: "13800001003",
    companyName: "ArchIToken",
    unitId: "unit-design",
    positionId: "pos-concept-designer",
    roleKey: "delete_protected",
    avatarLabel: resolveAvatarIdentity("唐老鸭", "donald.duck").label,
    avatarColor: resolveAvatarIdentity("唐老鸭", "donald.duck").color,
    status: "active",
    passwordUpdatedAt: "2026-05-12",
    updatedAt: "2026-05-27",
  },
  {
    id: "person-mickey-mouse",
    fullName: "米老鼠",
    accountName: "mickey.mouse",
    email: "mickey.mouse@architoken.local",
    phone: "13800001004",
    companyName: "ArchIToken",
    unitId: "unit-finance",
    positionId: "pos-finance-director",
    roleKey: "read_only",
    avatarLabel: resolveAvatarIdentity("米老鼠", "mickey.mouse").label,
    avatarColor: resolveAvatarIdentity("米老鼠", "mickey.mouse").color,
    status: "locked",
    passwordUpdatedAt: "2026-05-01",
    updatedAt: "2026-05-26",
  },
  {
    id: "person-tom-cat",
    fullName: "汤姆猫",
    accountName: "tom.cat",
    email: "tom.cat@architoken.local",
    phone: "13800001005",
    companyName: "ArchIToken",
    unitId: "unit-hr",
    positionId: "pos-admin-director",
    roleKey: "no_access",
    avatarLabel: resolveAvatarIdentity("汤姆猫", "tom.cat").label,
    avatarColor: resolveAvatarIdentity("汤姆猫", "tom.cat").color,
    status: "active",
    passwordUpdatedAt: "2026-05-15",
    updatedAt: "2026-05-28",
  },
];

export function SettingsCenterIamPanel({
  compact = false,
  onAudit,
}: {
  compact?: boolean;
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [initialIdentityRegistry] = useState(readInitialIdentityRegistry);
  const [people, setPeople] = useState<SettingsPersonAccount[]>(
    initialIdentityRegistry.people,
  );
  const [units, setUnits] = useState<SettingsOrgUnit[]>(
    initialIdentityRegistry.units,
  );
  const [positions, setPositions] = useState<SettingsPosition[]>(
    initialIdentityRegistry.positions,
  );
  const [activeConsole, setActiveConsole] =
    useState<SettingsConsoleView>("overview");
  const [activeView, setActiveView] = useState<DirectoryView>("people");
  const [searchText, setSearchText] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [personDraft, setPersonDraft] = useState<SettingsPersonAccount>(
    clonePerson(initialPeople[0]!),
  );
  const [unitDraft, setUnitDraft] = useState<SettingsOrgUnit>({
    ...initialUnits[0]!,
  });
  const [positionDraft, setPositionDraft] = useState<SettingsPosition>({
    ...initialPositions[0]!,
  });
  const [passwordDraft, setPasswordDraft] = useState({
    password: "",
    confirm: "",
  });
  const [positionInsertAfterId, setPositionInsertAfterId] = useState<
    string | null
  >(null);
  const [selectedPersonId, setSelectedPersonId] = useState(
    initialIdentityRegistry.people[0]?.id ?? "",
  );
  const [identityContextMenu, setIdentityContextMenu] =
    useState<IdentityContextMenuState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localIdRef = useRef(getNextIdentitySequence(initialIdentityRegistry));

  useEffect(() => {
    const snapshot = { people, units, positions };
    persistIdentityRegistry(snapshot);
    localIdRef.current = Math.max(
      localIdRef.current,
      getNextIdentitySequence(snapshot),
    );
  }, [people, positions, units]);

  const unitById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units],
  );
  const positionById = useMemo(
    () => new Map(positions.map((position) => [position.id, position])),
    [positions],
  );
  const roleByKey = useMemo(
    () => new Map(roleTemplates.map((role) => [role.roleKey, role])),
    [],
  );

  const filteredPeople = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => {
      const unitName = unitById.get(person.unitId)?.name ?? "";
      const positionName = positionById.get(person.positionId)?.name ?? "";
      const roleName = roleByKey.get(person.roleKey)?.name ?? "";
      return [
        person.fullName,
        person.accountName,
        person.email,
        person.phone,
        person.companyName,
        unitName,
        positionName,
        roleName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [people, positionById, roleByKey, searchText, unitById]);

  const filteredUnits = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return units;
    return units.filter((unit) => unit.name.toLowerCase().includes(query));
  }, [searchText, units]);

  const filteredPositions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return positions;
    return positions.filter((position) =>
      [position.name, position.level, unitById.get(position.unitId)?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [positions, searchText, unitById]);

  const emitAudit = (action: string, detail: string) => {
    onAudit?.(createModuleAuditEvent(action, "SettingsCenterIamPanel", detail));
  };

  const reserveLocalId = (prefix: string) => {
    const next = localIdRef.current;
    localIdRef.current += 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  };

  const reserveSequence = () => {
    const next = localIdRef.current;
    localIdRef.current += 1;
    return next;
  };

  const clearMessages = () => {
    setError(null);
    setNotice(null);
  };

  const closeIdentityContextMenu = () => {
    setIdentityContextMenu(null);
  };

  const openIdentityBackgroundContextMenu = (
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    setIdentityContextMenu({
      kind: "background",
      view: activeView,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openCreate = (options: IdentityCreateOptions = {}) => {
    if (activeView === "permissions") return; // 权限矩阵为只读视图
    clearMessages();
    setPositionInsertAfterId(null);
    if (activeView === "people") {
      setPersonDraft(
        createBlankPerson(
          units,
          positions,
          reserveLocalId("person"),
          people.length + 1,
        ),
      );
      setPasswordDraft({ password: "", confirm: "" });
      setDialog({ kind: "person", mode: "create" });
      return;
    }
    if (activeView === "units") {
      const unitId = reserveLocalId("unit");
      const unit = {
        id: unitId,
        name: "新部门",
        code: unitId,
      };
      setUnitDraft(unit);
      setDialog({ kind: "unit", mode: "create" });
      return;
    }
    const positionId = reserveLocalId("pos");
    const anchorPosition = options.afterPositionId
      ? positions.find((position) => position.id === options.afterPositionId)
      : null;
    const position = {
      id: positionId,
      name: "新岗位",
      code: positionId,
      unitId: anchorPosition?.unitId ?? units[0]?.id ?? "",
      level: anchorPosition?.level ?? "L3",
    };
    setPositionInsertAfterId(anchorPosition?.id ?? null);
    setPositionDraft(position);
    setDialog({ kind: "position", mode: "create" });
  };

  const openPerson = (person: SettingsPersonAccount) => {
    clearMessages();
    setSelectedPersonId(person.id);
    closeIdentityContextMenu();
    setPersonDraft(clonePerson(person));
    setPasswordDraft({ password: "", confirm: "" });
    setDialog({ kind: "person", mode: "edit", id: person.id });
  };

  const selectPerson = (person: SettingsPersonAccount) => {
    setSelectedPersonId(person.id);
    closeIdentityContextMenu();
  };

  const openPersonContextMenu = (
    person: SettingsPersonAccount,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedPersonId(person.id);
    setIdentityContextMenu({
      kind: "person",
      personId: person.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openUnitContextMenu = (
    unit: SettingsOrgUnit,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setIdentityContextMenu({
      kind: "unit",
      unitId: unit.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openPositionContextMenu = (
    position: SettingsPosition,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setIdentityContextMenu({
      kind: "position",
      positionId: position.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const openUnit = (unit: SettingsOrgUnit) => {
    clearMessages();
    closeIdentityContextMenu();
    setUnitDraft({ ...unit });
    setDialog({ kind: "unit", mode: "edit", id: unit.id });
  };

  const openPosition = (position: SettingsPosition) => {
    clearMessages();
    closeIdentityContextMenu();
    setPositionDraft({ ...position });
    setDialog({ kind: "position", mode: "edit", id: position.id });
  };

  const closeDialog = () => {
    setDialog(null);
    setPasswordDraft({ password: "", confirm: "" });
    setPositionInsertAfterId(null);
  };

  const savePerson = () => {
    clearMessages();
    const validation = validatePerson(personDraft, people, dialog?.id);
    if (validation) {
      setError(validation);
      return;
    }
    if (passwordDraft.password || passwordDraft.confirm) {
      const passwordError = validatePassword(passwordDraft);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    const avatarIdentity = resolveAvatarIdentity(
      personDraft.fullName,
      personDraft.accountName,
    );
    const nextPerson: SettingsPersonAccount = {
      ...personDraft,
      avatarLabel: normalizeAvatarLabel(
        personDraft.avatarLabel || avatarIdentity.label,
        personDraft.fullName,
      ),
      avatarColor: personDraft.avatarColor || avatarIdentity.color,
      passwordUpdatedAt: passwordDraft.password
        ? today()
        : personDraft.passwordUpdatedAt,
      updatedAt: today(),
    };

    setPeople((current) => {
      if (dialog?.mode === "create") return [nextPerson, ...current];
      return current.map((person) =>
        person.id === nextPerson.id ? nextPerson : person,
      );
    });
    closeDialog();
    setNotice(dialog?.mode === "create" ? "已新建人员账号" : "已保存人员账号");
    emitAudit(
      dialog?.mode === "create"
        ? "settings-person-create"
        : "settings-person-update",
      `${nextPerson.fullName} / ${nextPerson.accountName}`,
    );
  };

  const deletePerson = () => {
    if (dialog?.kind !== "person" || dialog.mode !== "edit") return;
    clearMessages();
    deletePersonById(personDraft.id);
    closeDialog();
  };

  const deletePersonById = (personId: string) => {
    const target = people.find((person) => person.id === personId);
    if (!target) return;
    setPeople((current) => current.filter((person) => person.id !== personId));
    setSelectedPersonId((current) => (current === personId ? "" : current));
    closeIdentityContextMenu();
    setNotice("已删除人员账号");
    emitAudit(
      "settings-person-delete",
      `${target.fullName} / ${target.accountName}`,
    );
  };

  const resetPassword = () => {
    clearMessages();
    const temporaryPassword = `AT-${String(reserveSequence()).padStart(6, "0")}`;
    const nextPerson = {
      ...personDraft,
      passwordUpdatedAt: today(),
      updatedAt: today(),
    };
    setPersonDraft(nextPerson);
    if (dialog?.mode === "edit") {
      setPeople((current) =>
        current.map((person) =>
          person.id === nextPerson.id ? nextPerson : person,
        ),
      );
    }
    setNotice(`已生成临时密码 ${temporaryPassword}`);
    emitAudit(
      "settings-password-reset",
      `${nextPerson.fullName} / ${nextPerson.accountName}`,
    );
  };

  const resetPersonPasswordById = (personId: string) => {
    const target = people.find((person) => person.id === personId);
    if (!target) return;
    clearMessages();
    const temporaryPassword = `AT-${String(reserveSequence()).padStart(6, "0")}`;
    const nextPerson = {
      ...target,
      passwordUpdatedAt: today(),
      updatedAt: today(),
    };
    setPeople((current) =>
      current.map((person) => (person.id === personId ? nextPerson : person)),
    );
    closeIdentityContextMenu();
    setNotice(`已生成临时密码 ${temporaryPassword}`);
    emitAudit(
      "settings-password-reset",
      `${nextPerson.fullName} / ${nextPerson.accountName}`,
    );
  };

  const copyTemporaryPasswordNotice = async () => {
    if (!notice?.includes("AT-")) return;
    const password = notice.split(" ").at(-1) ?? "";
    try {
      await navigator.clipboard.writeText(password);
      setNotice("临时密码已复制");
    } catch {
      setError("当前浏览器不允许写入剪贴板。");
    }
  };

  const saveUnit = () => {
    clearMessages();
    const validation = validateUnit(unitDraft);
    if (validation) {
      setError(validation);
      return;
    }
    const nextUnit = {
      ...unitDraft,
      name: unitDraft.name.trim(),
      code: unitDraft.code.trim() || unitDraft.id,
    };
    setUnits((current) => {
      if (dialog?.mode === "create") return [nextUnit, ...current];
      return current.map((unit) => (unit.id === nextUnit.id ? nextUnit : unit));
    });
    closeDialog();
    setNotice(dialog?.mode === "create" ? "已新建部门" : "已保存部门");
    emitAudit("settings-unit-save", `${nextUnit.name} / ${nextUnit.code}`);
  };

  const deleteUnit = () => {
    if (dialog?.kind !== "unit" || dialog.mode !== "edit") return;
    if (deleteUnitById(unitDraft.id)) closeDialog();
  };

  const deleteUnitById = (unitId: string) => {
    clearMessages();
    const target = units.find((unit) => unit.id === unitId);
    if (!target) return false;
    if (people.some((person) => person.unitId === unitId)) {
      setError("该部门仍被人员使用，不能删除。");
      closeIdentityContextMenu();
      return false;
    }
    if (positions.some((position) => position.unitId === unitId)) {
      setError("该部门仍被岗位使用，不能删除。");
      closeIdentityContextMenu();
      return false;
    }
    setUnits((current) => current.filter((unit) => unit.id !== unitId));
    closeIdentityContextMenu();
    setNotice("已删除部门");
    emitAudit("settings-unit-delete", `${target.name} / ${target.code}`);
    return true;
  };

  const savePosition = () => {
    clearMessages();
    const validation = validatePosition(positionDraft, positions, dialog?.id);
    if (validation) {
      setError(validation);
      return;
    }
    const nextPosition = {
      ...positionDraft,
      name: positionDraft.name.trim(),
      code: positionDraft.code.trim() || positionDraft.id,
    };
    setPositions((current) => {
      if (dialog?.mode === "create") {
        const anchorIndex = positionInsertAfterId
          ? current.findIndex(
              (position) => position.id === positionInsertAfterId,
            )
          : -1;
        if (anchorIndex >= 0) {
          const next = [...current];
          next.splice(anchorIndex + 1, 0, nextPosition);
          return next;
        }
        return [...current, nextPosition];
      }
      return current.map((position) =>
        position.id === nextPosition.id ? nextPosition : position,
      );
    });
    closeDialog();
    setNotice(dialog?.mode === "create" ? "已新建岗位" : "已保存岗位");
    emitAudit(
      "settings-position-save",
      `${nextPosition.name} / ${nextPosition.code}`,
    );
  };

  const deletePosition = () => {
    if (dialog?.kind !== "position" || dialog.mode !== "edit") return;
    if (deletePositionById(positionDraft.id)) closeDialog();
  };

  const deletePositionById = (positionId: string) => {
    clearMessages();
    const target = positions.find((position) => position.id === positionId);
    if (!target) return false;
    if (people.some((person) => person.positionId === positionId)) {
      setError("该岗位仍被人员使用，不能删除。");
      closeIdentityContextMenu();
      return false;
    }
    setPositions((current) =>
      current.filter((position) => position.id !== positionId),
    );
    closeIdentityContextMenu();
    setNotice("已删除岗位");
    emitAudit("settings-position-delete", `${target.name} / ${target.code}`);
    return true;
  };

  const movePosition = (
    position: SettingsPosition,
    direction: PositionMoveDirection,
  ) => {
    clearMessages();
    let moved = false;
    setPositions((current) => {
      const fromIndex = current.findIndex((item) => item.id === position.id);
      if (fromIndex < 0) return current;
      const lastIndex = current.length - 1;
      const toIndex =
        direction === "top"
          ? 0
          : direction === "bottom"
            ? lastIndex
            : direction === "up"
              ? Math.max(0, fromIndex - 1)
              : Math.min(lastIndex, fromIndex + 1);
      if (toIndex === fromIndex) return current;
      moved = true;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      if (!item) return current;
      next.splice(toIndex, 0, item);
      return next;
    });
    closeIdentityContextMenu();
    if (!moved) return;
    const directionLabel =
      direction === "top"
        ? "置顶"
        : direction === "bottom"
          ? "置底"
          : direction === "up"
            ? "上移"
            : "下移";
    setNotice(`已${directionLabel}岗位`);
    emitAudit(
      "settings-position-reorder",
      `${position.name} / ${directionLabel}`,
    );
  };

  const newButtonLabel =
    activeView === "people"
      ? "新建人员"
      : activeView === "units"
        ? "新建部门"
        : "新建岗位";

  if (activeConsole === "overview") {
    return (
      <section
        className={[
          "settings-iam-panel flex min-h-0 flex-col",
          compact ? "mt-3 gap-3" : "border-t px-4 pb-4 pt-4",
        ].join(" ")}
        data-testid="settings-center-overview"
      >
        <SettingsCenterOverview
          peopleCount={people.length}
          unitCount={units.length}
          positionCount={positions.length}
          roleCount={roleTemplates.length}
          onOpen={setActiveConsole}
        />
      </section>
    );
  }

  if (activeConsole === "database") {
    return (
      <section
        className={[
          "settings-iam-panel flex min-h-0 flex-col",
          compact ? "mt-3 gap-3" : "border-t px-4 pb-4 pt-4",
        ].join(" ")}
        data-testid="settings-center-database-console"
      >
        <SettingsCenterPageHeader
          eyebrow="Database Runtime Control Plane"
          title="数据库管理"
          description="统一查看 ArchIToken data-plane 绑定、运行状态、连接入口和巡检动作。"
          onBack={() => setActiveConsole("overview")}
        />
        <SettingsCenterDatabasePanel onAudit={onAudit} />
      </section>
    );
  }

  if (activeConsole === "ops") {
    return (
      <section
        className={[
          "settings-iam-panel flex min-h-0 flex-col",
          compact ? "mt-3 gap-3" : "border-t px-4 pb-4 pt-4",
        ].join(" ")}
        data-testid="settings-center-ops-console"
      >
        <SettingsCenterPageHeader
          eyebrow="Operations Center"
          title="运维中心"
          description="统一管理容器、k3s 集群、本地大模型与主机运行态，并提供日志查看和运维终端。"
          onBack={() => setActiveConsole("overview")}
        />
        <SettingsCenterOpsPanel onAudit={onAudit} />
      </section>
    );
  }

  return (
    <section
      className={[
        "settings-iam-panel flex min-h-0 flex-col",
        compact ? "mt-3 gap-3" : "border-t px-4 pb-4 pt-4",
      ].join(" ")}
      data-testid="settings-center-crud"
      onClick={closeIdentityContextMenu}
    >
      <SettingsCenterPageHeader
        eyebrow="Identity Registry"
        title="人员权限"
        description="维护人员、部门、岗位、邮箱、密码、头像和权限设置；主列表保持一行记录，双击进入编辑弹窗。"
        onBack={() => setActiveConsole("overview")}
        action={
          activeView === "permissions" ? undefined : (
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700"
              data-testid="settings-create-person"
            >
              <UserPlus className="h-4 w-4" />
              {newButtonLabel}
            </button>
          )
        }
      />

      <MessageBanner
        error={error}
        notice={notice}
        onClearError={() => setError(null)}
        onCopyNotice={() => void copyTemporaryPasswordNotice()}
      />

      <div className="grid gap-2 md:grid-cols-4">
        <MetricCard
          label="人员账号"
          value={people.length}
          icon={<UsersRound className="h-4 w-4" />}
        />
        <MetricCard
          label="部门"
          value={units.length}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="岗位"
          value={positions.length}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <MetricCard
          label="权限设置"
          value={roleTemplates.length}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <div className="min-h-0 rounded-md border border-slate-100 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <TabButton
              active={activeView === "people"}
              onClick={() => setActiveView("people")}
            >
              人员账号
            </TabButton>
            <TabButton
              active={activeView === "units"}
              onClick={() => setActiveView("units")}
            >
              部门管理
            </TabButton>
            <TabButton
              active={activeView === "positions"}
              onClick={() => setActiveView("positions")}
            >
              岗位管理
            </TabButton>
            <TabButton
              active={activeView === "permissions"}
              onClick={() => setActiveView("permissions")}
            >
              权限矩阵
            </TabButton>
          </div>
          <label className="relative block min-w-0 xl:w-[360px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索姓名、手机、单位、部门、岗位、邮箱"
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              data-testid="settings-search-person"
            />
          </label>
        </div>

        {activeView === "people" ? (
          <PeopleRows
            people={filteredPeople}
            selectedPersonId={selectedPersonId}
            unitById={unitById}
            positionById={positionById}
            roleByKey={roleByKey}
            onSelect={selectPerson}
            onEdit={openPerson}
            onContextMenu={openPersonContextMenu}
            onBackgroundContextMenu={openIdentityBackgroundContextMenu}
            onDelete={deletePersonById}
          />
        ) : null}

        {activeView === "units" ? (
          <UnitRows
            units={filteredUnits}
            positions={positions}
            people={people}
            onOpen={openUnit}
            onContextMenu={openUnitContextMenu}
            onBackgroundContextMenu={openIdentityBackgroundContextMenu}
          />
        ) : null}

        {activeView === "positions" ? (
          <PositionRows
            positions={filteredPositions}
            people={people}
            unitById={unitById}
            onOpen={openPosition}
            onContextMenu={openPositionContextMenu}
            onBackgroundContextMenu={openIdentityBackgroundContextMenu}
          />
        ) : null}

        {activeView === "permissions" ? <PermissionMatrixView people={people} /> : null}
      </div>

      {identityContextMenu ? (
        <IdentityContextMenu
          menu={identityContextMenu}
          person={
            identityContextMenu.kind === "person"
              ? people.find((item) => item.id === identityContextMenu.personId)
              : undefined
          }
          unit={
            identityContextMenu.kind === "unit"
              ? units.find((item) => item.id === identityContextMenu.unitId)
              : undefined
          }
          position={
            identityContextMenu.kind === "position"
              ? positions.find(
                  (item) => item.id === identityContextMenu.positionId,
                )
              : undefined
          }
          positions={positions}
          onClose={closeIdentityContextMenu}
          onCreate={openCreate}
          onEdit={(person) => openPerson(person)}
          onResetPassword={(person) => resetPersonPasswordById(person.id)}
          onDelete={(person) => deletePersonById(person.id)}
          onEditUnit={(unit) => openUnit(unit)}
          onDeleteUnit={(unit) => deleteUnitById(unit.id)}
          onEditPosition={(position) => openPosition(position)}
          onDeletePosition={(position) => deletePositionById(position.id)}
          onMovePosition={movePosition}
        />
      ) : null}

      {dialog?.kind === "person" ? (
        <SettingsDialog
          title={dialog.mode === "create" ? "新建人员账号" : "编辑人员账号"}
          onClose={closeDialog}
          footer={
            <DialogFooter
              mode={dialog.mode}
              onDelete={deletePerson}
              onSave={savePerson}
            />
          }
        >
          <PersonForm
            draft={personDraft}
            units={units}
            positions={positions}
            passwordDraft={passwordDraft}
            onDraftChange={setPersonDraft}
            onPasswordChange={setPasswordDraft}
            onResetPassword={resetPassword}
          />
        </SettingsDialog>
      ) : null}

      {dialog?.kind === "unit" ? (
        <SettingsDialog
          title={dialog.mode === "create" ? "新建部门" : "编辑部门"}
          onClose={closeDialog}
          footer={
            <DialogFooter
              mode={dialog.mode}
              onDelete={deleteUnit}
              onSave={saveUnit}
            />
          }
        >
          <div className="grid gap-3">
            <TextField
              label="部门名称"
              value={unitDraft.name}
              onChange={(value) =>
                setUnitDraft((current) => ({ ...current, name: value }))
              }
              testId="settings-unit-name"
            />
          </div>
        </SettingsDialog>
      ) : null}

      {dialog?.kind === "position" ? (
        <SettingsDialog
          title={dialog.mode === "create" ? "新建岗位" : "编辑岗位"}
          onClose={closeDialog}
          footer={
            <DialogFooter
              mode={dialog.mode}
              onDelete={deletePosition}
              onSave={savePosition}
            />
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="岗位名称"
              value={positionDraft.name}
              onChange={(value) =>
                setPositionDraft((current) => ({ ...current, name: value }))
              }
              testId="settings-position-name"
            />
            <SelectField
              label="所在部门"
              value={positionDraft.unitId}
              onChange={(value) =>
                setPositionDraft((current) => ({
                  ...current,
                  unitId: value,
                }))
              }
              options={units.map((unit) => ({
                value: unit.id,
                label: unit.name,
              }))}
              testId="settings-position-unit"
            />
            <TextField
              label="岗位等级"
              value={positionDraft.level}
              onChange={(value) =>
                setPositionDraft((current) => ({ ...current, level: value }))
              }
              testId="settings-position-level"
            />
          </div>
        </SettingsDialog>
      ) : null}
    </section>
  );
}

function SettingsCenterOverview({
  peopleCount,
  unitCount,
  positionCount,
  roleCount,
  onOpen,
}: {
  peopleCount: number;
  unitCount: number;
  positionCount: number;
  roleCount: number;
  onOpen: (
    value: Extract<SettingsConsoleView, "identity" | "database" | "ops">,
  ) => void;
}) {
  // 实时健康摘要：静默拉取运维/数据库快照，卡片即时反映容器、集群与存储水位
  const [opsHealth, setOpsHealth] = useState<string[] | null>(null);
  const [dbHealth, setDbHealth] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/ops-center", { cache: "no-store" })
      .then((response) => response.json())
      .then(
        (data: {
          containerSummary?: { running?: number; total?: number };
          k8s?: { available?: boolean; podSummary?: { running?: number } };
          host?: { gpu?: { utilPct?: number | null } | null; memUsedPct?: number };
        }) => {
          if (!alive) return;
          const metrics: string[] = [];
          if (data.containerSummary) {
            metrics.push(
              `容器 ${data.containerSummary.running ?? 0}/${data.containerSummary.total ?? 0}`,
            );
          }
          metrics.push(
            data.k8s?.available
              ? `Pod ${data.k8s.podSummary?.running ?? 0}`
              : "k3s 不可达",
          );
          if (data.host?.memUsedPct !== undefined) metrics.push(`内存 ${data.host.memUsedPct}%`);
          if (data.host?.gpu && data.host.gpu.utilPct !== null && data.host.gpu.utilPct !== undefined) {
            metrics.push(`GPU ${data.host.gpu.utilPct}%`);
          }
          setOpsHealth(metrics);
        },
      )
      .catch(() => {
        /* 健康摘要失败时保留静态文案 */
      });
    fetch("/api/database-runtime", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { stores?: Array<{ status?: string }> }) => {
        if (!alive || !data.stores) return;
        const total = data.stores.length;
        const live = data.stores.filter((store) => store.status === "live").length;
        const offline = data.stores.filter(
          (store) => store.status !== "live" && store.status !== "empty",
        ).length;
        setDbHealth([
          `存储 ${live}/${total} 在线`,
          offline > 0 ? `${offline} 个异常` : "巡检正常",
          "运行状态",
        ]);
      })
      .catch(() => {
        /* 同上 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <header className="min-w-0">
        <p className="arch-primary-text font-mono text-[10px]">
          Settings Center
        </p>
        <h3 className="arch-text mt-1 text-base font-medium">设置中心</h3>
        <p className="arch-muted mt-1 max-w-4xl text-xs leading-5">
          人员权限与数据库运行态分开管理，进入对应页面后再进行新增、右键操作、巡检和运维。
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <SettingsCenterHomeCard
          testId="settings-center-card-identity"
          icon={<UsersRound className="h-5 w-5" />}
          eyebrow="Identity Registry"
          title="人员权限"
          description="维护人员账号、部门、岗位和权限模板。"
          metrics={[
            `人员 ${peopleCount}`,
            `部门 ${unitCount}`,
            `岗位 ${positionCount}`,
            `权限 ${roleCount}`,
          ]}
          onClick={() => onOpen("identity")}
        />
        <SettingsCenterHomeCard
          testId="settings-center-card-database"
          icon={<Database className="h-5 w-5" />}
          eyebrow="Database Runtime"
          title="数据库管理"
          description="查看数据平面、存储对象、连接端口、巡检和二级管理入口。"
          metrics={dbHealth ?? ["data-plane", "绑定巡检", "运行状态"]}
          onClick={() => onOpen("database")}
        />
        <SettingsCenterHomeCard
          testId="settings-center-card-ops"
          icon={<Wrench className="h-5 w-5" />}
          eyebrow="Operations Center"
          title="运维中心"
          description="容器编排、k3s 集群、本地大模型、主机指标、日志与运维终端统一管控。"
          metrics={opsHealth ?? ["容器", "k3s", "大模型", "终端"]}
          onClick={() => onOpen("ops")}
        />
      </div>
    </div>
  );
}

function SettingsCenterHomeCard({
  testId,
  icon,
  eyebrow,
  title,
  description,
  metrics,
  onClick,
}: {
  testId: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  metrics: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[180px] flex-col justify-between rounded-md border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
      data-testid={testId}
    >
      <span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        <span className="arch-primary-text mt-4 block font-mono text-[10px]">
          {eyebrow}
        </span>
        <span className="arch-text mt-1 block text-base font-semibold">
          {title}
        </span>
        <span className="arch-muted mt-2 block text-xs leading-5">
          {description}
        </span>
      </span>
      <span className="mt-4 flex items-end justify-between gap-3">
        <span className="flex flex-wrap gap-1.5">
          {metrics.map((metric) => (
            <span
              key={metric}
              className="rounded-full border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
            >
              {metric}
            </span>
          ))}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
      </span>
    </button>
  );
}

function SettingsCenterPageHeader({
  eyebrow,
  title,
  description,
  onBack,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px]">{eyebrow}</p>
          <h3 className="arch-text mt-1 text-base font-medium">{title}</h3>
          <p className="arch-muted mt-1 max-w-4xl text-xs leading-5">
            {description}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}

function MessageBanner({
  error,
  notice,
  onClearError,
  onCopyNotice,
}: {
  error: string | null;
  notice: string | null;
  onClearError: () => void;
  onCopyNotice: () => void;
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
        <button
          type="button"
          onClick={onClearError}
          className="ml-auto rounded p-0.5 hover:bg-rose-100"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  if (!notice) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{notice}</span>
      {notice.includes("AT-") ? (
        <button
          type="button"
          onClick={onCopyNotice}
          className="ml-auto inline-flex items-center gap-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs hover:bg-emerald-50"
        >
          <Copy className="h-3.5 w-3.5" />
          复制
        </button>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-xl font-medium text-slate-900">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-8 rounded-md border px-3 text-sm",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PeopleRows({
  people,
  selectedPersonId,
  unitById,
  positionById,
  roleByKey,
  onSelect,
  onEdit,
  onContextMenu,
  onBackgroundContextMenu,
  onDelete,
}: {
  people: SettingsPersonAccount[];
  selectedPersonId: string;
  unitById: Map<string, SettingsOrgUnit>;
  positionById: Map<string, SettingsPosition>;
  roleByKey: Map<string, SettingsRole>;
  onSelect: (person: SettingsPersonAccount) => void;
  onEdit: (person: SettingsPersonAccount) => void;
  onContextMenu: (
    person: SettingsPersonAccount,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onBackgroundContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onDelete: (personId: string) => void;
}) {
  return (
    <div className="overflow-auto" onContextMenu={onBackgroundContextMenu}>
      <div className="grid w-full min-w-[1560px] grid-cols-[220px_130px_150px_150px_150px_240px_110px_150px_120px] border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
        <span>人员姓名</span>
        <span>手机号码</span>
        <span>工作单位</span>
        <span>所在部门</span>
        <span>担任岗位</span>
        <span>邮箱账号</span>
        <span>当前状态</span>
        <span>权限管理</span>
        <span>更新时间</span>
      </div>
      {people.map((person) => {
        const selected = selectedPersonId === person.id;
        return (
          <div
            key={person.id}
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(person);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onEdit(person);
            }}
            onContextMenu={(event) => {
              event.stopPropagation();
              onContextMenu(person, event);
            }}
            onKeyDown={(event) =>
              handlePersonRowKeyDown(event, person, onEdit, onDelete)
            }
            className={[
              "grid min-h-[56px] w-full min-w-[1560px] cursor-default grid-cols-[220px_130px_150px_150px_150px_240px_110px_150px_120px] items-center border-b px-3 py-2 text-left outline-none last:border-b-0",
              selected
                ? "border-emerald-100 bg-emerald-50/70"
                : "border-slate-50 hover:bg-emerald-50/40",
            ].join(" ")}
            data-testid={`settings-person-${person.id}`}
            title="单击选中，双击编辑，右键打开操作菜单"
          >
            <span className="flex min-w-0 items-center gap-3">
              <AvatarMark person={person} className="h-9 w-9" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {person.fullName}
                </span>
                <span className="block truncate font-mono text-xs text-slate-500">
                  {person.accountName}
                </span>
              </span>
            </span>
            <span className="font-mono text-xs text-slate-600">
              {person.phone || "-"}
            </span>
            <span className="truncate text-sm text-slate-700">
              {person.companyName || "未填写"}
            </span>
            <span className="truncate text-sm text-slate-700">
              {unitById.get(person.unitId)?.name ?? "未分配"}
            </span>
            <span className="truncate text-sm text-slate-700">
              {positionById.get(person.positionId)?.name ?? "未分配"}
            </span>
            <span className="truncate font-mono text-xs text-slate-600">
              {person.email || "未填邮箱"}
            </span>
            <span>
              <span
                className={[
                  "rounded border px-1.5 py-0.5 text-[11px]",
                  statusClassNames[person.status],
                ].join(" ")}
              >
                {statusLabels[person.status]}
              </span>
            </span>
            <span className="truncate text-sm text-slate-700">
              {roleByKey.get(person.roleKey)?.name ?? person.roleKey}
            </span>
            <span className="font-mono text-xs text-slate-500">
              {person.updatedAt}
            </span>
          </div>
        );
      })}
      {people.length === 0 ? <EmptyRows label="没有匹配的人员账号" /> : null}
    </div>
  );
}

function handlePersonRowKeyDown(
  event: KeyboardEvent<HTMLElement>,
  person: SettingsPersonAccount,
  onEdit: (person: SettingsPersonAccount) => void,
  onDelete: (personId: string) => void,
) {
  if (event.key === "Enter") {
    event.preventDefault();
    onEdit(person);
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    onDelete(person.id);
  }
}

function IdentityContextMenu({
  menu,
  person,
  unit,
  position,
  positions,
  onClose,
  onCreate,
  onEdit,
  onResetPassword,
  onDelete,
  onEditUnit,
  onDeleteUnit,
  onEditPosition,
  onDeletePosition,
  onMovePosition,
}: {
  menu: IdentityContextMenuState;
  person?: SettingsPersonAccount | undefined;
  unit?: SettingsOrgUnit | undefined;
  position?: SettingsPosition | undefined;
  positions: SettingsPosition[];
  onClose: () => void;
  onCreate: (options?: IdentityCreateOptions) => void;
  onEdit: (person: SettingsPersonAccount) => void;
  onResetPassword: (person: SettingsPersonAccount) => void;
  onDelete: (person: SettingsPersonAccount) => void;
  onEditUnit: (unit: SettingsOrgUnit) => void;
  onDeleteUnit: (unit: SettingsOrgUnit) => void;
  onEditPosition: (position: SettingsPosition) => void;
  onDeletePosition: (position: SettingsPosition) => void;
  onMovePosition: (
    position: SettingsPosition,
    direction: PositionMoveDirection,
  ) => void;
}) {
  const run = (action: () => void) => {
    action();
    onClose();
  };
  const createLabel =
    menu.kind === "position"
      ? "新建岗位"
      : menu.kind === "unit"
        ? "新建部门"
        : menu.kind === "background" && menu.view === "positions"
          ? "新建岗位"
          : menu.kind === "background" && menu.view === "units"
            ? "新建部门"
            : "新建人员";

  if (menu.kind === "person" && !person) return null;
  if (menu.kind === "unit" && !unit) return null;
  if (menu.kind === "position" && !position) return null;
  const positionIndex = position
    ? positions.findIndex((item) => item.id === position.id)
    : -1;
  const canMovePositionUp = positionIndex > 0;
  const canMovePositionDown =
    positionIndex >= 0 && positionIndex < positions.length - 1;
  const menuPoint = clampContextMenuPoint(
    menu.x,
    menu.y,
    176,
    menu.kind === "position" ? 256 : 176,
  );

  return (
    <div
      className="fixed z-[60] max-h-[calc(100vh-16px)] w-44 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl"
      style={{ left: menuPoint.x, top: menuPoint.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      aria-label="设置中心操作菜单"
      data-testid="settings-identity-context-menu"
    >
      {menu.kind === "person" && person ? (
        <>
          <ContextMenuButton
            icon={<SquarePen className="h-4 w-4" />}
            label="编辑人员"
            onClick={() => run(() => onEdit(person))}
          />
          <ContextMenuButton
            icon={<KeyRound className="h-4 w-4" />}
            label="重置密码"
            onClick={() => run(() => onResetPassword(person))}
          />
          <ContextMenuButton
            icon={<UserPlus className="h-4 w-4" />}
            label="新建人员"
            onClick={() => run(() => onCreate())}
          />
          <div className="my-1 h-px bg-slate-100" />
          <ContextMenuButton
            danger
            icon={<Trash2 className="h-4 w-4" />}
            label="删除人员"
            onClick={() => run(() => onDelete(person))}
          />
        </>
      ) : null}
      {menu.kind === "unit" && unit ? (
        <>
          <ContextMenuButton
            icon={<Building2 className="h-4 w-4" />}
            label="编辑部门"
            onClick={() => run(() => onEditUnit(unit))}
          />
          <ContextMenuButton
            icon={<UserPlus className="h-4 w-4" />}
            label="新建部门"
            onClick={() => run(() => onCreate())}
          />
          <div className="my-1 h-px bg-slate-100" />
          <ContextMenuButton
            danger
            icon={<Trash2 className="h-4 w-4" />}
            label="删除部门"
            onClick={() => run(() => onDeleteUnit(unit))}
          />
        </>
      ) : null}
      {menu.kind === "position" && position ? (
        <>
          <ContextMenuButton
            icon={<Briefcase className="h-4 w-4" />}
            label="编辑岗位"
            onClick={() => run(() => onEditPosition(position))}
          />
          <ContextMenuButton
            icon={<UserPlus className="h-4 w-4" />}
            label="新建岗位"
            onClick={() =>
              run(() => onCreate({ afterPositionId: position.id }))
            }
          />
          <div className="my-1 h-px bg-slate-100" />
          <ContextMenuButton
            disabled={!canMovePositionUp}
            icon={<ArrowUp className="h-4 w-4" />}
            label="上移"
            onClick={() => run(() => onMovePosition(position, "up"))}
          />
          <ContextMenuButton
            disabled={!canMovePositionDown}
            icon={<ArrowDown className="h-4 w-4" />}
            label="下移"
            onClick={() => run(() => onMovePosition(position, "down"))}
          />
          <ContextMenuButton
            disabled={!canMovePositionUp}
            icon={<ChevronsUp className="h-4 w-4" />}
            label="置顶"
            onClick={() => run(() => onMovePosition(position, "top"))}
          />
          <ContextMenuButton
            disabled={!canMovePositionDown}
            icon={<ChevronsDown className="h-4 w-4" />}
            label="置底"
            onClick={() => run(() => onMovePosition(position, "bottom"))}
          />
          <div className="my-1 h-px bg-slate-100" />
          <ContextMenuButton
            danger
            icon={<Trash2 className="h-4 w-4" />}
            label="删除岗位"
            onClick={() => run(() => onDeletePosition(position))}
          />
        </>
      ) : null}
      {menu.kind === "background" ? (
        <ContextMenuButton
          icon={<UserPlus className="h-4 w-4" />}
          label={createLabel}
          onClick={() => run(() => onCreate())}
        />
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="sr-only"
        aria-label="关闭菜单"
      />
    </div>
  );
}

function ContextMenuButton({
  icon,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-8 w-full items-center gap-2 px-3 text-left",
        disabled
          ? "cursor-not-allowed text-slate-300"
          : danger
            ? "text-rose-600 hover:bg-rose-50"
            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function clampContextMenuPoint(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (typeof window === "undefined") return { x, y };
  const margin = 8;
  return {
    x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
    y: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
  };
}

function readStoredIdentityRegistry(): IdentityRegistrySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(identityRegistryStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IdentityRegistrySnapshot>;
    if (
      !Array.isArray(parsed.people) ||
      !Array.isArray(parsed.units) ||
      !Array.isArray(parsed.positions)
    ) {
      return null;
    }
    return {
      people: parsed.people.filter(isSettingsPersonAccount),
      units: parsed.units.filter(isSettingsOrgUnit),
      positions: parsed.positions.filter(isSettingsPosition),
    };
  } catch {
    return null;
  }
}

function readInitialIdentityRegistry(): IdentityRegistrySnapshot {
  return (
    readStoredIdentityRegistry() ?? {
      people: initialPeople,
      units: initialUnits,
      positions: initialPositions,
    }
  );
}

function persistIdentityRegistry(snapshot: IdentityRegistrySnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      identityRegistryStorageKey,
      JSON.stringify(snapshot),
    );
  } catch {
    // Local persistence is best-effort for the browser workbench.
  }
}

function getNextIdentitySequence(snapshot: IdentityRegistrySnapshot) {
  const ids = [
    ...snapshot.people.map((person) => person.id),
    ...snapshot.units.map((unit) => unit.id),
    ...snapshot.positions.map((position) => position.id),
  ];
  const maxSequence = ids.reduce((max, id) => {
    const match = /-(\d+)$/.exec(id);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return maxSequence + 1;
}

function isSettingsOrgUnit(value: unknown): value is SettingsOrgUnit {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    (typeof value.parentId === "undefined" ||
      typeof value.parentId === "string")
  );
}

function isSettingsPosition(value: unknown): value is SettingsPosition {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.unitId === "string" &&
    typeof value.level === "string"
  );
}

function isSettingsPersonAccount(
  value: unknown,
): value is SettingsPersonAccount {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.fullName === "string" &&
    typeof value.accountName === "string" &&
    typeof value.email === "string" &&
    typeof value.phone === "string" &&
    typeof value.companyName === "string" &&
    typeof value.unitId === "string" &&
    typeof value.positionId === "string" &&
    typeof value.roleKey === "string" &&
    typeof value.avatarLabel === "string" &&
    typeof value.avatarColor === "string" &&
    (typeof value.avatarImageUrl === "undefined" ||
      typeof value.avatarImageUrl === "string") &&
    isAccountStatus(value.status) &&
    typeof value.passwordUpdatedAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isAccountStatus(value: unknown): value is AccountStatus {
  return value === "active" || value === "locked" || value === "disabled";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function UnitRows({
  units,
  positions,
  people,
  onOpen,
  onContextMenu,
  onBackgroundContextMenu,
}: {
  units: SettingsOrgUnit[];
  positions: SettingsPosition[];
  people: SettingsPersonAccount[];
  onOpen: (unit: SettingsOrgUnit) => void;
  onContextMenu: (
    unit: SettingsOrgUnit,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onBackgroundContextMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div className="overflow-auto" onContextMenu={onBackgroundContextMenu}>
      <div className="grid w-full min-w-[560px] grid-cols-[minmax(240px,1fr)_120px_120px] border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
        <span>部门</span>
        <span>人员</span>
        <span>岗位</span>
      </div>
      {units.map((unit) => (
        <button
          key={unit.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(unit);
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
            onContextMenu(unit, event);
          }}
          className="grid min-h-[52px] w-full min-w-[560px] grid-cols-[minmax(240px,1fr)_120px_120px] items-center border-b border-slate-50 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50/50"
          data-testid={`settings-unit-${unit.id}`}
          title="左键编辑，右键打开操作菜单"
        >
          <span className="truncate text-sm font-medium text-slate-900">
            {unit.name}
          </span>
          <span className="text-sm text-slate-700">
            {people.filter((person) => person.unitId === unit.id).length}
          </span>
          <span className="text-sm text-slate-700">
            {positions.filter((position) => position.unitId === unit.id).length}
          </span>
        </button>
      ))}
      {units.length === 0 ? <EmptyRows label="没有匹配的部门" /> : null}
    </div>
  );
}

function PositionRows({
  positions,
  people,
  unitById,
  onOpen,
  onContextMenu,
  onBackgroundContextMenu,
}: {
  positions: SettingsPosition[];
  people: SettingsPersonAccount[];
  unitById: Map<string, SettingsOrgUnit>;
  onOpen: (position: SettingsPosition) => void;
  onContextMenu: (
    position: SettingsPosition,
    event: MouseEvent<HTMLElement>,
  ) => void;
  onBackgroundContextMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div className="overflow-auto" onContextMenu={onBackgroundContextMenu}>
      <div className="grid w-full min-w-[720px] grid-cols-[minmax(240px,1fr)_220px_120px_120px] border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
        <span>岗位</span>
        <span>所在部门</span>
        <span>等级</span>
        <span>人员</span>
      </div>
      {positions.map((position) => (
        <button
          key={position.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(position);
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
            onContextMenu(position, event);
          }}
          className="grid min-h-[52px] w-full min-w-[720px] grid-cols-[minmax(240px,1fr)_220px_120px_120px] items-center border-b border-slate-50 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50/50"
          data-testid={`settings-position-${position.id}`}
          title="左键编辑，右键打开操作菜单"
        >
          <span className="truncate text-sm font-medium text-slate-900">
            {position.name}
          </span>
          <span className="truncate text-sm text-slate-700">
            {unitById.get(position.unitId)?.name ?? "未分配"}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {position.level}
          </span>
          <span className="text-sm text-slate-700">
            {
              people.filter((person) => person.positionId === position.id)
                .length
            }
          </span>
        </button>
      ))}
      {positions.length === 0 ? <EmptyRows label="没有匹配的岗位" /> : null}
    </div>
  );
}

function EmptyRows({ label }: { label: string }) {
  return (
    <div className="px-3 py-10 text-center text-sm text-slate-500">{label}</div>
  );
}

function SettingsDialog({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
      <div className="flex max-h-[calc(100vh-48px)] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h4 className="text-sm font-medium text-slate-900">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-4">{children}</div>
        <div className="border-t border-slate-100 px-4 py-3">{footer}</div>
      </div>
    </div>
  );
}

function DialogFooter({
  mode,
  onDelete,
  onSave,
}: {
  mode: "create" | "edit";
  onDelete: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {mode === "edit" ? (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm text-rose-600 hover:bg-rose-50"
          data-testid="settings-delete-person"
        >
          <Trash2 className="h-4 w-4" />
          删除
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700"
        data-testid="settings-save-person"
      >
        <Save className="h-4 w-4" />
        保存
      </button>
    </div>
  );
}

function PersonForm({
  draft,
  units,
  positions,
  passwordDraft,
  onDraftChange,
  onPasswordChange,
  onResetPassword,
}: {
  draft: SettingsPersonAccount;
  units: SettingsOrgUnit[];
  positions: SettingsPosition[];
  passwordDraft: { password: string; confirm: string };
  onDraftChange: (draft: SettingsPersonAccount) => void;
  onPasswordChange: (draft: { password: string; confirm: string }) => void;
  onResetPassword: () => void;
}) {
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(
    null,
  );
  const generatedAvatar = useMemo(
    () => resolveAvatarIdentity(draft.fullName, draft.accountName),
    [draft.accountName, draft.fullName],
  );

  const updateNameAndAvatar = (fullName: string) => {
    const avatar = resolveAvatarIdentity(fullName, draft.accountName);
    onDraftChange({
      ...draft,
      fullName,
      avatarLabel: avatar.label,
      avatarColor: avatar.color,
    });
  };

  const updateAccountAndAvatar = (accountName: string) => {
    const avatar = resolveAvatarIdentity(draft.fullName, accountName);
    onDraftChange({
      ...draft,
      accountName,
      avatarLabel: avatar.label,
      avatarColor: avatar.color,
    });
  };

  const applyGeneratedAvatar = () => {
    setAvatarUploadError(null);
    const nextDraft = removeAvatarImage(draft);
    onDraftChange({
      ...nextDraft,
      avatarLabel: generatedAvatar.label,
      avatarColor: generatedAvatar.color,
    });
  };

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("只能上传图片文件。");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarUploadError("头像图片不要超过 3 MB。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAvatarUploadError(null);
      onDraftChange({ ...draft, avatarImageUrl: reader.result });
    };
    reader.onerror = () => {
      setAvatarUploadError("头像读取失败，请换一张图片。");
    };
    reader.readAsDataURL(file);
  };

  const updateAvatarColor = (value: string) => {
    if (!isValidHexColor(value)) return;
    onDraftChange({ ...draft, avatarColor: value });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label="人员姓名"
            value={draft.fullName}
            onChange={updateNameAndAvatar}
            testId="settings-full-name"
          />
          <TextField
            label="手机号码"
            value={draft.phone}
            onChange={(value) => onDraftChange({ ...draft, phone: value })}
            testId="settings-phone"
          />
          <TextField
            label="工作单位"
            value={draft.companyName}
            onChange={(value) =>
              onDraftChange({ ...draft, companyName: value })
            }
            testId="settings-company"
          />
          <SelectField
            label="所在部门"
            value={draft.unitId}
            onChange={(value) => onDraftChange({ ...draft, unitId: value })}
            options={units.map((unit) => ({
              value: unit.id,
              label: unit.name,
            }))}
            testId="settings-unit-select"
          />
          <SelectField
            label="担任岗位"
            value={draft.positionId}
            onChange={(value) => onDraftChange({ ...draft, positionId: value })}
            options={positions.map((position) => ({
              value: position.id,
              label: formatPositionOptionLabel(position, positions, units),
            }))}
            placeholder={positions.length ? "请选择岗位" : "暂无岗位"}
            testId="settings-position-select"
          />
          <TextField
            label="邮箱账号"
            value={draft.email}
            onChange={(value) => onDraftChange({ ...draft, email: value })}
            testId="settings-email"
          />
          <TextField
            label="登录账号"
            value={draft.accountName}
            onChange={updateAccountAndAvatar}
            testId="settings-account-name"
          />
          <SelectField
            label="当前状态"
            value={draft.status}
            onChange={(value) =>
              onDraftChange({ ...draft, status: value as AccountStatus })
            }
            options={[
              { value: "active", label: "启用" },
              { value: "locked", label: "锁定" },
              { value: "disabled", label: "停用" },
            ]}
            testId="settings-status-select"
          />
          <SelectField
            label="权限管理"
            value={draft.roleKey}
            onChange={(value) => onDraftChange({ ...draft, roleKey: value })}
            options={roleTemplates.map((role) => ({
              value: role.roleKey,
              label: role.name,
            }))}
            testId="settings-role-select"
          />
        </div>

        <div className="rounded-md border border-slate-100 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            密码
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <TextField
              label="新密码"
              type="password"
              value={passwordDraft.password}
              onChange={(value) =>
                onPasswordChange({ ...passwordDraft, password: value })
              }
              testId="settings-password"
            />
            <TextField
              label="确认密码"
              type="password"
              value={passwordDraft.confirm}
              onChange={(value) =>
                onPasswordChange({ ...passwordDraft, confirm: value })
              }
              testId="settings-password-confirm"
            />
            <button
              type="button"
              onClick={onResetPassword}
              className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              data-testid="settings-reset-password"
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            最近更新: {draft.passwordUpdatedAt || "-"}
          </p>
        </div>
      </div>

      <div className="grid content-start gap-3">
        <div className="rounded-md border border-slate-100 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
            <ImageIcon className="h-4 w-4 text-emerald-600" />
            头像
          </div>
          <div className="flex items-start gap-3">
            <AvatarMark person={draft} className="h-16 w-16" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={applyGeneratedAvatar}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              自动生成
            </button>
            <button
              type="button"
              onClick={() => avatarFileInputRef.current?.click()}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
            >
              <Upload className="h-3.5 w-3.5" />
              上传头像
            </button>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          {draft.avatarImageUrl ? (
            <button
              type="button"
              onClick={() => onDraftChange(removeAvatarImage(draft))}
              className="mt-2 text-xs text-slate-500 hover:text-rose-600"
            >
              移除上传头像，使用自动头像
            </button>
          ) : null}
          {avatarUploadError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-600">
              {avatarUploadError}
            </p>
          ) : null}
          <AvatarColorPicker
            value={draft.avatarColor || generatedAvatar.color}
            onChange={updateAvatarColor}
          />
        </div>
      </div>
    </div>
  );
}

function AvatarColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = normalizeHexColor(value);
  const hsv = useMemo(() => hexToHsv(normalizedValue), [normalizedValue]);
  const [red, green, blue] = hexToRgb(normalizedValue);
  const hueColor = hsvToHex({ hue: hsv.hue, saturation: 100, brightness: 100 });
  const [hexDraftState, setHexDraftState] = useState({
    source: normalizedValue,
    draft: normalizedValue.toUpperCase(),
  });
  const hexDraft =
    hexDraftState.source === normalizedValue
      ? hexDraftState.draft
      : normalizedValue.toUpperCase();

  function commitHsv(next: ColorHsv) {
    onChange(hsvToHex(next));
  }

  function pickFromPanel(clientX: number, clientY: number, fixedHue: number) {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const saturation = clampNumber(
      ((clientX - rect.left) / rect.width) * 100,
      0,
      100,
    );
    const brightness = clampNumber(
      100 - ((clientY - rect.top) / rect.height) * 100,
      0,
      100,
    );
    commitHsv({ hue: fixedHue, saturation, brightness });
  }

  function pickFromHue(
    clientX: number,
    saturation: number,
    brightness: number,
  ) {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const hue = clampNumber(((clientX - rect.left) / rect.width) * 360, 0, 360);
    commitHsv({ hue, saturation, brightness });
  }

  function startPanelPick(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const hue = hsv.hue;
    pickFromPanel(event.clientX, event.clientY, hue);

    function handlePointerMove(moveEvent: PointerEvent) {
      pickFromPanel(moveEvent.clientX, moveEvent.clientY, hue);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener(
      "pointerup",
      () => window.removeEventListener("pointermove", handlePointerMove),
      { once: true },
    );
  }

  function startHuePick(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const saturation = hsv.saturation;
    const brightness = hsv.brightness;
    pickFromHue(event.clientX, saturation, brightness);

    function handlePointerMove(moveEvent: PointerEvent) {
      pickFromHue(moveEvent.clientX, saturation, brightness);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener(
      "pointerup",
      () => window.removeEventListener("pointermove", handlePointerMove),
      { once: true },
    );
  }

  function updateHexDraft(nextValue: string) {
    const normalizedDraft = nextValue.startsWith("#")
      ? nextValue
      : `#${nextValue}`;
    setHexDraftState({
      source: normalizedValue,
      draft: normalizedDraft.toUpperCase(),
    });
    if (isValidHexColor(normalizedDraft)) {
      onChange(normalizeHexColor(normalizedDraft));
    }
  }

  function restoreHexDraft() {
    if (!isValidHexColor(hexDraft)) {
      setHexDraftState({
        source: normalizedValue,
        draft: normalizedValue.toUpperCase(),
      });
    }
  }

  return (
    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/70 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">无限调色盘</span>
        <span
          className="h-7 w-9 rounded-md border border-slate-200 shadow-inner"
          style={{ background: normalizedValue }}
          aria-label="当前头像颜色"
        />
      </div>

      <div
        ref={panelRef}
        role="slider"
        tabIndex={0}
        aria-label="选择头像颜色饱和度和亮度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.brightness)}
        aria-valuetext={`${Math.round(hsv.saturation)}%, ${Math.round(
          hsv.brightness,
        )}%`}
        onPointerDown={startPanelPick}
        className="relative h-32 cursor-crosshair overflow-hidden rounded-md border border-slate-200"
        style={{
          background: `linear-gradient(to top, #000 0%, transparent 100%), linear-gradient(to right, #fff 0%, ${hueColor} 100%)`,
        }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.55),0_2px_6px_rgba(15,23,42,0.3)]"
          style={{
            left: `${hsv.saturation}%`,
            top: `${100 - hsv.brightness}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <div
        ref={hueRef}
        role="slider"
        tabIndex={0}
        aria-label="选择头像颜色色相"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.hue)}
        aria-valuetext={`${Math.round(hsv.hue)}°`}
        onPointerDown={startHuePick}
        className="relative mt-2 h-4 cursor-ew-resize rounded-full border border-slate-200"
        style={{
          background:
            "linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ef4444)",
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-5 w-2 rounded-full border border-white bg-slate-900 shadow"
          style={{
            left: `${(hsv.hue / 360) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <label className="col-span-3 grid gap-1 text-[11px] font-medium text-slate-500">
          HEX
          <input
            value={hexDraft}
            onChange={(event) => updateHexDraft(event.target.value)}
            onBlur={restoreHexDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") restoreHexDraft();
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
            aria-label="头像颜色 HEX 色号"
          />
        </label>
        <ColorNumberField
          label="R"
          value={red}
          min={0}
          max={255}
          onChange={(next) => onChange(rgbToHex(next, green, blue))}
        />
        <ColorNumberField
          label="G"
          value={green}
          min={0}
          max={255}
          onChange={(next) => onChange(rgbToHex(red, next, blue))}
        />
        <ColorNumberField
          label="B"
          value={blue}
          min={0}
          max={255}
          onChange={(next) => onChange(rgbToHex(red, green, next))}
        />
        <ColorNumberField
          label="H"
          value={Math.round(hsv.hue)}
          min={0}
          max={360}
          onChange={(next) => commitHsv({ ...hsv, hue: next })}
        />
        <ColorNumberField
          label="S"
          value={Math.round(hsv.saturation)}
          min={0}
          max={100}
          onChange={(next) => commitHsv({ ...hsv, saturation: next })}
        />
        <ColorNumberField
          label="V"
          value={Math.round(hsv.brightness)}
          min={0}
          max={100}
          onChange={(next) => commitHsv({ ...hsv, brightness: next })}
        />
      </div>
    </div>
  );
}

function ColorNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-[11px] font-medium text-slate-500">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(event) => {
          if (!event.target.value) return;
          onChange(clampNumber(Number(event.target.value), min, max));
        }}
        className="h-8 min-w-0 rounded-md border border-slate-200 bg-white px-1.5 font-mono text-xs text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function AvatarMark({
  person,
  className,
}: {
  person: SettingsPersonAccount;
  className: string;
}) {
  const generated = resolveAvatarIdentity(person.fullName, person.accountName);
  const color = person.avatarColor || generated.color;
  const shadowColor = mixColor(color, "#111827", 0.22);
  const highlightColor = mixColor(color, "#ffffff", 0.36);
  const style = person.avatarImageUrl
    ? {
        backgroundImage: `url(${person.avatarImageUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : {
        background: `linear-gradient(135deg, ${highlightColor}, ${color})`,
      };

  return (
    <span
      className={[
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md ring-1 ring-black/5",
        className,
      ].join(" ")}
      style={style}
      aria-label={`${person.fullName || "人员"}头像`}
    >
      {person.avatarImageUrl ? null : (
        <AvatarIllustration
          identity={generated}
          color={color}
          shadowColor={shadowColor}
          highlightColor={highlightColor}
        />
      )}
    </span>
  );
}

function AvatarIllustration({
  identity,
  color,
  shadowColor,
  highlightColor,
}: {
  identity: AvatarIdentity;
  color: string;
  shadowColor: string;
  highlightColor: string;
}) {
  if (identity.kind === "pikachu") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M19 7 11 27l13-6Z" fill="#111827" />
        <path d="M45 7 53 27l-13-6Z" fill="#111827" />
        <path d="M19 7 24 31 33 24Z" fill={color} />
        <path d="M45 7 40 31 31 24Z" fill={color} />
        <circle cx="32" cy="36" r="22" fill={color} />
        <path
          d="M14 34c6-10 19-14 34-9-4-7-11-10-19-9-8 1-13 7-15 18Z"
          fill={highlightColor}
          opacity="0.7"
        />
        <circle cx="24" cy="36" r="3" fill="#111827" />
        <circle cx="41" cy="36" r="3" fill="#111827" />
        <circle cx="21" cy="45" r="4.5" fill={identity.accentColor} />
        <circle cx="45" cy="45" r="4.5" fill={identity.accentColor} />
        <path
          d="m30 40 3 1.8 3-1.8"
          fill="none"
          stroke="#7c2d12"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M28 48c2.7 2.4 6.4 2.4 9 0"
          fill="none"
          stroke="#7c2d12"
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <path
          d="m49 48 7 1-5 5 6 1-12 6 4-9-6-1Z"
          fill={identity.accentColor}
          opacity="0.95"
        />
      </svg>
    );
  }

  if (identity.kind === "strawberry_bear") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <circle cx="18" cy="19" r="9" fill={color} />
        <circle cx="46" cy="19" r="9" fill={color} />
        <circle cx="18" cy="19" r="4" fill={highlightColor} opacity="0.75" />
        <circle cx="46" cy="19" r="4" fill={highlightColor} opacity="0.75" />
        <circle cx="32" cy="36" r="23" fill={color} />
        <path
          d="M22 13c3-6 9-7 14-2 4-3 8-3 11-1-2 3-5 5-10 5-5 0-10 0-15-2Z"
          fill="#22c55e"
        />
        {[18, 27, 39, 47, 23, 34, 43].map((cx, index) => (
          <ellipse
            key={index}
            cx={cx}
            cy={index < 4 ? 31 : 50}
            rx="1.1"
            ry="2"
            fill={identity.accentColor}
            opacity="0.9"
          />
        ))}
        <circle cx="24" cy="37" r="3.2" fill="#111827" />
        <circle cx="41" cy="37" r="3.2" fill="#111827" />
        <ellipse
          cx="32"
          cy="43"
          rx="8"
          ry="6"
          fill={highlightColor}
          opacity="0.85"
        />
        <circle cx="32" cy="41" r="2.4" fill={shadowColor} />
        <path
          d="M27 47c2.8 2 7.2 2 10 0"
          fill="none"
          stroke={shadowColor}
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <circle
          cx="50"
          cy="14"
          r="4"
          fill={identity.accentColor}
          stroke="#fff"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  if (identity.kind === "duck") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path
          d="M20 17c6-9 21-9 27 0 7 10 5 28-7 35-8 5-20 2-25-7-5-9-2-21 5-28Z"
          fill="#ffffff"
        />
        <path
          d="M20 17c6-9 21-9 27 0 4 6 5 15 2 23-3-9-12-14-25-13-4 0-7 1-10 3 1-5 3-10 6-13Z"
          fill={highlightColor}
          opacity="0.65"
        />
        <path d="M19 18c6-8 19-10 29-4l-2-8c-7-3-16-2-23 3Z" fill={color} />
        <path
          d="M22 9c8-4 17-4 26 1-5-8-16-9-26-1Z"
          fill={identity.accentColor}
        />
        <circle cx="25" cy="34" r="3" fill="#111827" />
        <circle cx="39" cy="34" r="3" fill="#111827" />
        <path d="M24 42c6-5 16-5 23 0-3 7-17 8-23 0Z" fill="#f97316" />
        <path
          d="M26 42h19"
          stroke="#c2410c"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M12 38c-4 1-7 4-8 8 6 0 10-2 12-7Z"
          fill={identity.accentColor}
          opacity="0.85"
        />
      </svg>
    );
  }

  if (identity.kind === "mouse") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <circle cx="17" cy="18" r="12" fill={color} />
        <circle cx="47" cy="18" r="12" fill={color} />
        <circle cx="32" cy="36" r="22" fill={color} />
        <path
          d="M20 39c0-12 24-12 24 0 0 9-5 14-12 14s-12-5-12-14Z"
          fill={highlightColor}
        />
        <circle cx="25" cy="34" r="3" fill="#ffffff" />
        <circle cx="39" cy="34" r="3" fill="#ffffff" />
        <circle cx="25" cy="34" r="1.6" fill="#111827" />
        <circle cx="39" cy="34" r="1.6" fill="#111827" />
        <ellipse cx="32" cy="42" rx="4" ry="2.8" fill={identity.accentColor} />
        <path
          d="M25 48c4 3 10 3 14 0"
          fill="none"
          stroke={shadowColor}
          strokeLinecap="round"
          strokeWidth="2.4"
        />
        <path d="M7 50h50v14H7Z" fill={identity.accentColor} opacity="0.92" />
      </svg>
    );
  }

  if (identity.kind === "cat") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <path d="M13 12 26 21 15 31Z" fill={color} />
        <path d="M51 12 38 21l11 10Z" fill={color} />
        <path
          d="M17 17 25 24l-7 4Z"
          fill={identity.accentColor}
          opacity="0.65"
        />
        <path
          d="M47 17 39 24l7 4Z"
          fill={identity.accentColor}
          opacity="0.65"
        />
        <circle cx="32" cy="36" r="22" fill={color} />
        <path
          d="M16 34c5-9 18-14 34-7-3-8-11-12-21-11-8 1-13 7-13 18Z"
          fill={highlightColor}
          opacity="0.68"
        />
        <ellipse cx="24" cy="37" rx="3.2" ry="2.4" fill="#111827" />
        <ellipse cx="41" cy="37" rx="3.2" ry="2.4" fill="#111827" />
        <path
          d="m29 43 3 2 3-2"
          fill="none"
          stroke={shadowColor}
          strokeLinecap="round"
          strokeWidth="2.2"
        />
        <path
          d="M16 43h10M15 48h11M38 43h10M38 48h11"
          stroke={shadowColor}
          strokeLinecap="round"
          strokeWidth="1.8"
          opacity="0.75"
        />
        <path
          d="M28 50c3 2.2 6.8 2.2 9 0"
          fill="none"
          stroke={shadowColor}
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <rect x="9" y="9" width="46" height="46" rx="14" fill={color} />
      <circle
        cx="21"
        cy="20"
        r="6"
        fill={identity.accentColor}
        opacity="0.85"
      />
      <circle
        cx="45"
        cy="20"
        r="6"
        fill={identity.accentColor}
        opacity="0.85"
      />
      <circle cx="32" cy="35" r="20" fill={color} />
      <path
        d="M16 34c3-12 13-19 26-17 5 1 9 3 12 7-9-1-18 1-27 6-5 3-8 4-11 4Z"
        fill={highlightColor}
        opacity="0.72"
      />
      <circle cx="24" cy="35" r="3" fill="#111827" />
      <circle cx="40" cy="35" r="3" fill="#111827" />
      <circle
        cx="20"
        cy="43"
        r="3.2"
        fill={identity.accentColor}
        opacity="0.65"
      />
      <circle
        cx="44"
        cy="43"
        r="3.2"
        fill={identity.accentColor}
        opacity="0.65"
      />
      <path
        d="M25 46c3.8 3 10.4 3 14 0"
        fill="none"
        stroke={shadowColor}
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <circle
        cx="49"
        cy="15"
        r="5"
        fill={identity.accentColor}
        stroke="#fff"
        strokeWidth="1.5"
      />
    </svg>
  );
}

type ColorHsv = {
  hue: number;
  saturation: number;
  brightness: number;
};

function TextField({
  label,
  value,
  onChange,
  type = "text",
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  testId?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        data-testid={testId}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  testId?: string;
}) {
  const hasCurrentValue = options.some((option) => option.value === value);
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      {label}
      <select
        value={hasCurrentValue ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
        data-testid={testId}
        disabled={options.length === 0}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function clonePerson(person: SettingsPersonAccount): SettingsPersonAccount {
  return { ...person };
}

function removeAvatarImage(
  person: SettingsPersonAccount,
): SettingsPersonAccount {
  const nextPerson = { ...person };
  delete nextPerson.avatarImageUrl;
  return nextPerson;
}

function createBlankPerson(
  units: SettingsOrgUnit[],
  positions: SettingsPosition[],
  id: string,
  accountIndex: number,
): SettingsPersonAccount {
  const unitId = units[0]?.id ?? "";
  const positionId =
    positions.find((position) => position.unitId === unitId)?.id ??
    positions[0]?.id ??
    "";
  const accountName = `user.${String(accountIndex).padStart(3, "0")}`;
  const avatar = resolveAvatarIdentity("新人员", accountName);
  return {
    id,
    fullName: "新人员",
    accountName,
    email: "",
    phone: "",
    companyName: "ArchIToken",
    unitId,
    positionId,
    roleKey: "read_only",
    avatarLabel: avatar.label,
    avatarColor: avatar.color,
    status: "active",
    passwordUpdatedAt: "-",
    updatedAt: today(),
  };
}

function validatePerson(
  draft: SettingsPersonAccount,
  people: SettingsPersonAccount[],
  selectedId?: string,
): string | null {
  if (!draft.fullName.trim()) return "姓名不能为空。";
  if (!draft.accountName.trim()) return "登录账号不能为空。";
  if (!draft.companyName.trim()) return "工作单位不能为空。";
  if (!draft.unitId) return "必须选择所在部门。";
  if (!draft.positionId) return "必须选择岗位。";

  const duplicatedAccount = people.some(
    (person) =>
      person.id !== selectedId &&
      person.accountName.trim().toLowerCase() ===
        draft.accountName.trim().toLowerCase(),
  );
  if (duplicatedAccount) return "登录账号已存在。";

  if (draft.email.trim()) {
    const duplicatedEmail = people.some(
      (person) =>
        person.id !== selectedId &&
        person.email.trim().toLowerCase() === draft.email.trim().toLowerCase(),
    );
    if (duplicatedEmail) return "邮箱已存在。";
  }

  return null;
}

function validateUnit(draft: SettingsOrgUnit): string | null {
  if (!draft.name.trim()) return "部门名称不能为空。";
  return null;
}

function validatePosition(
  draft: SettingsPosition,
  positions: SettingsPosition[],
  selectedId?: string,
): string | null {
  if (!draft.name.trim()) return "岗位名称不能为空。";
  if (!draft.unitId) return "必须选择所在部门。";
  const duplicatedName = positions.some(
    (position) =>
      position.id !== selectedId &&
      position.unitId === draft.unitId &&
      isSamePositionName(position.name, draft.name),
  );
  if (duplicatedName) return "同一部门内岗位名称已存在。";
  return null;
}

function isSamePositionName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function formatPositionOptionLabel(
  position: SettingsPosition,
  positions: SettingsPosition[],
  units: SettingsOrgUnit[],
): string {
  const duplicatedName = positions.some(
    (item) =>
      item.id !== position.id && isSamePositionName(item.name, position.name),
  );
  if (!duplicatedName) return position.name;
  const unitName =
    units.find((unit) => unit.id === position.unitId)?.name ?? "未分配部门";
  return `${position.name}（${unitName}）`;
}

function validatePassword(passwordDraft: {
  password: string;
  confirm: string;
}): string | null {
  if (passwordDraft.password.length < 8) return "密码至少需要 8 位。";
  if (passwordDraft.password !== passwordDraft.confirm)
    return "两次密码不一致。";
  return null;
}

function normalizeAvatarLabel(label: string, fullName: string): string {
  const source = label.trim() || fullName.trim() || "人";
  return Array.from(source).slice(0, 2).join("");
}

function resolveAvatarIdentity(
  fullName: string,
  accountName: string,
  variant = 0,
): AvatarIdentity {
  const source = [fullName, accountName].join(" ").trim() || "person";
  const normalizedSource = source.toLowerCase();
  const semanticProfile = semanticAvatarProfiles.find((profile) =>
    profile.keywords.some((keyword) =>
      normalizedSource.includes(keyword.toLowerCase()),
    ),
  );

  if (semanticProfile && variant === 0) {
    return {
      label: semanticProfile.label,
      color: semanticProfile.color,
      accentColor: semanticProfile.accentColor,
      kind: semanticProfile.kind,
    };
  }

  const hash = hashString(`${source}:${variant}`);
  const hue = (hash + variant * 137) % 360;
  return {
    label: normalizeAvatarLabel("", fullName),
    color: hslToHex(hue, 72, 46),
    accentColor: hslToHex((hue + 42 + (hash % 64)) % 360, 78, 56),
    kind: "generic",
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = normalizedLightness - chroma / 2;
  const [red, green, blue] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToHsv(hexColor: string): ColorHsv {
  const [redChannel, greenChannel, blueChannel] = hexToRgb(hexColor);
  const redValue = redChannel / 255;
  const greenValue = greenChannel / 255;
  const blueValue = blueChannel / 255;
  const max = Math.max(redValue, greenValue, blueValue);
  const min = Math.min(redValue, greenValue, blueValue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === redValue) {
      hue = ((greenValue - blueValue) / delta) % 6;
    } else if (max === greenValue) {
      hue = (blueValue - redValue) / delta + 2;
    } else {
      hue = (redValue - greenValue) / delta + 4;
    }
    hue *= 60;
  }

  return {
    hue: Math.round((hue + 360) % 360),
    saturation: max === 0 ? 0 : Math.round((delta / max) * 100),
    brightness: Math.round(max * 100),
  };
}

function hsvToHex(color: ColorHsv): string {
  const hue = ((color.hue % 360) + 360) % 360;
  const saturation = clampNumber(color.saturation, 0, 100) / 100;
  const brightness = clampNumber(color.brightness, 0, 100) / 100;
  const chroma = brightness * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = brightness - chroma;
  const [red, green, blue] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return rgbToHex(
    (red + match) * 255,
    (green + match) * 255,
    (blue + match) * 255,
  );
}

function mixColor(hexColor: string, targetHexColor: string, weight: number) {
  const source = hexToRgb(hexColor);
  const target = hexToRgb(targetHexColor);
  return rgbToHex(
    source[0] * (1 - weight) + target[0] * weight,
    source[1] * (1 - weight) + target[1] * weight,
    source[2] * (1 - weight) + target[2] * weight,
  );
}

function hexToRgb(hexColor: string): [number, number, number] {
  const normalized = hexColor.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return [16, 185, 129];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function normalizeHexColor(hexColor: string): string {
  const normalized = hexColor.trim().startsWith("#")
    ? hexColor.trim()
    : `#${hexColor.trim()}`;
  if (!isValidHexColor(normalized)) return "#10B981";
  return normalized.toUpperCase();
}

function isValidHexColor(hexColor: string): boolean {
  return /^#[\da-f]{6}$/i.test(hexColor.trim());
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 权限矩阵（只读）：角色 × 能力对照、成员分布与账号安全巡检
// ---------------------------------------------------------------------------
const PERMISSION_CAPABILITIES = ["查看", "新增", "编辑", "删除", "权限管理"] as const;

const ROLE_CAPABILITY_MATRIX: Record<string, boolean[]> = {
  administrator: [true, true, true, true, true],
  read_write: [true, true, true, true, false],
  delete_protected: [true, true, true, false, false],
  read_only: [true, false, false, false, false],
  no_access: [false, false, false, false, false],
};

const PASSWORD_STALE_DAYS = 90;

function PermissionMatrixView({ people }: { people: SettingsPersonAccount[] }) {
  const [now] = useState(() => Date.now());

  const memberCountByRole = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of people) {
      counts.set(person.roleKey, (counts.get(person.roleKey) ?? 0) + 1);
    }
    return counts;
  }, [people]);

  const passwordAges = useMemo(
    () =>
      people
        .map((person) => {
          const updated = Date.parse(person.passwordUpdatedAt);
          const days = Number.isFinite(updated)
            ? Math.floor((now - updated) / (24 * 3600 * 1000))
            : null;
          return { person, days };
        })
        .sort((a, b) => (b.days ?? -1) - (a.days ?? -1)),
    [people, now],
  );

  const stale = passwordAges.filter(
    (entry) => entry.days !== null && entry.days > PASSWORD_STALE_DAYS,
  );
  const inactive = people.filter((person) => person.status !== "active");

  return (
    <div className="space-y-4 p-3">
      {stale.length > 0 || inactive.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <p className="font-medium">账号安全巡检：</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {stale.length > 0 ? (
              <li>
                {stale.length} 个账号密码超过 {PASSWORD_STALE_DAYS} 天未更新：
                {stale.map((entry) => entry.person.fullName).join("、")}
              </li>
            ) : null}
            {inactive.length > 0 ? (
              <li>
                {inactive.length} 个账号处于非启用状态：
                {inactive.map((person) => person.fullName).join("、")}
              </li>
            ) : null}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          账号安全巡检通过：密码均在 {PASSWORD_STALE_DAYS} 天周期内更新，无停用账号遗留。
        </div>
      )}

      <section className="rounded-md border border-slate-100 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-3">
          <p className="arch-primary-text font-mono text-[10px]">Permission Matrix</p>
          <h4 className="arch-text text-sm font-medium">角色 × 能力矩阵</h4>
        </header>
        <div className="overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">角色</th>
                {PERMISSION_CAPABILITIES.map((capability) => (
                  <th key={capability} className="px-3 py-2 text-center font-medium">
                    {capability}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">成员</th>
              </tr>
            </thead>
            <tbody>
              {roleTemplates.map((role) => {
                const capabilities = ROLE_CAPABILITY_MATRIX[role.roleKey] ?? [];
                return (
                  <tr key={role.roleKey} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-800">{role.name}</span>
                      <span className="arch-muted ml-2 font-mono text-[10px]">{role.roleKey}</span>
                    </td>
                    {PERMISSION_CAPABILITIES.map((capability, index) => (
                      <td key={capability} className="px-3 py-2 text-center">
                        {capabilities[index] ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-slate-600">
                      {memberCountByRole.get(role.roleKey) ?? 0} 人
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-slate-100 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-3">
          <p className="arch-primary-text font-mono text-[10px]">Credential Age</p>
          <h4 className="arch-text text-sm font-medium">
            密码更新情况（超过 {PASSWORD_STALE_DAYS} 天标记）
          </h4>
        </header>
        <div className="overflow-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">人员</th>
                <th className="px-3 py-2 font-medium">角色</th>
                <th className="px-3 py-2 font-medium">密码更新于</th>
                <th className="px-3 py-2 font-medium">距今</th>
                <th className="px-3 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {passwordAges.map(({ person, days }) => {
                const isStale = days !== null && days > PASSWORD_STALE_DAYS;
                const roleName =
                  roleTemplates.find((role) => role.roleKey === person.roleKey)?.name ??
                  person.roleKey;
                return (
                  <tr key={person.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{person.fullName}</td>
                    <td className="px-3 py-2 text-slate-600">{roleName}</td>
                    <td className="px-3 py-2 text-slate-600">{person.passwordUpdatedAt}</td>
                    <td className={"px-3 py-2 " + (isStale ? "text-amber-600" : "text-slate-600")}>
                      {days !== null ? `${days} 天` : "未知"}
                      {isStale ? "（需提醒更新）" : ""}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 " +
                          (person.status === "active" ? "text-emerald-700" : "text-slate-400")
                        }
                      >
                        <span
                          className={
                            "inline-block h-2 w-2 rounded-full " +
                            (person.status === "active" ? "bg-emerald-500" : "bg-slate-300")
                          }
                        />
                        {person.status === "active" ? "启用" : "停用"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

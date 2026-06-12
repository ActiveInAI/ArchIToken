// components/StandardLibraryNamingRulesPanel.tsx
// Prefabricated steel component standardized naming-rule explorer.
// Source-of-record for the naming-prefix allow-list enforced by the component BOM validator.
// License: Apache-2.0
"use client";

import {
  Boxes as BoxesOutlined,
  RefreshCw as ReloadOutlined,
  ShieldCheck as SafetyCertificateOutlined,
  Search as SearchOutlined,
} from "lucide-react";
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type ColumnsType,
} from "@/components/pan-ui";
import { useEffect, useMemo, useState } from "react";
import { ArchLoadingFlow } from "@/components/ArchLoadingFlow";
import { createModuleAuditEvent } from "@/lib/module-actions";
import {
  fetchComponentNamingRules,
  type ComponentNamingRule,
  type ComponentNamingRuleType,
} from "@/lib/component-naming-rules";
import type { ModuleAuditEvent } from "@/lib/module-file-system";

const { Text } = Typography;

const ruleTypeLabels: Record<ComponentNamingRuleType, string> = {
  general: "通用总则",
  component: "构件规则",
  version: "版本号规则",
};

const ruleTypeColors: Record<ComponentNamingRuleType, string> = {
  general: "purple",
  component: "blue",
  version: "gold",
};

export function StandardLibraryNamingRulesPanel({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [rules, setRules] = useState<ComponentNamingRule[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [standardName, setStandardName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ruleType, setRuleType] = useState<ComponentNamingRuleType | undefined>();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchComponentNamingRules();
      setRules(response.rules);
      setPrefixes(response.prefixes);
      setStandardName(response.standardName);
      onAudit?.(
        createModuleAuditEvent(
          "standard-library-naming-rules",
          "StandardLibraryNamingRulesPanel",
          `命名规则加载: ${response.ruleCount} 条 · ${response.prefixes.length} 个构件前缀（真源白名单）`,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rules.filter((rule) => {
      if (ruleType && rule.ruleType !== ruleType) return false;
      if (!needle) return true;
      return [
        rule.ruleKey,
        rule.prefix,
        rule.componentGroup,
        rule.componentType,
        rule.namingFormula,
        rule.standardExample,
        rule.ruleCategory,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rules, query, ruleType]);

  const columns = useMemo<ColumnsType<ComponentNamingRule>>(
    () => [
      {
        title: "类型",
        dataIndex: "ruleType",
        width: 96,
        render: (value: ComponentNamingRuleType) => (
          <Tag color={ruleTypeColors[value]}>{ruleTypeLabels[value]}</Tag>
        ),
      },
      {
        title: "前缀",
        dataIndex: "prefix",
        width: 120,
        render: (value: string) =>
          value ? <Text code>{value}</Text> : <Text type="secondary">—</Text>,
      },
      {
        title: "构件",
        dataIndex: "componentType",
        width: 200,
        render: (_, rule) =>
          rule.componentType ? (
            <span>
              <div>{rule.componentType}</div>
              {rule.componentGroup ? (
                <Text type="secondary" className="text-xs">
                  {rule.componentGroup}
                </Text>
              ) : null}
            </span>
          ) : (
            <Text type="secondary">{rule.ruleCategory || "—"}</Text>
          ),
      },
      {
        title: "命名公式 / 规则内容",
        dataIndex: "namingFormula",
        render: (value: string, rule) => (
          <span>
            <div>
              <Text code className="text-xs">
                {value || rule.fieldNotes || "—"}
              </Text>
            </div>
            {rule.standardExample ? (
              <Text type="secondary" className="text-xs">
                例：{rule.standardExample}
              </Text>
            ) : null}
          </span>
        ),
      },
      {
        title: "版本",
        dataIndex: "versionCode",
        width: 80,
        render: (value: string) =>
          value ? <Tag>{value}</Tag> : <Text type="secondary">—</Text>,
      },
      {
        title: "来源",
        dataIndex: "sourceSheet",
        width: 150,
        render: (value: string, rule) => (
          <Text type="secondary" className="text-xs">
            {value} · 第{rule.sourceRow}行
          </Text>
        ),
      },
    ],
    [],
  );

  const componentCount = rules.filter((r) => r.ruleType === "component").length;

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Space size={8} wrap>
          <Tag color="blue" icon={<BoxesOutlined size={12} />}>
            {standardName || "装配式钢结构构件标准化命名规则"}
          </Tag>
          <Tag icon={<SafetyCertificateOutlined size={12} />}>深化设计标准</Tag>
          <Tag color="processing">{rules.length} 条规则</Tag>
          <Tag color="success">{componentCount} 条构件规则</Tag>
        </Space>
        <Button
          icon={<ReloadOutlined size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <div className="mt-2 text-xs">
        <Text type="secondary">
          本表为命名规则的<b>真源记录</b>：构件 BOM 校验器据此判定命名前缀是否合规。
          命名核心公式：
          <Text code>构件类型_等级属性_规格型号_尺寸参数_楼层/位置_版本号</Text>。
        </Text>
      </div>

      {prefixes.length > 0 ? (
        <div className="mt-3 rounded-md border border-slate-100 p-3">
          <Text strong className="text-sm">
            构件前缀白名单（{prefixes.length}）· 校验真源
          </Text>
          <div className="mt-2 flex flex-wrap gap-1">
            {prefixes.map((prefix) => (
              <Tag key={prefix} color="blue">
                {prefix}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="命名规则读取失败"
          description={error}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          allowClear
          prefix={<SearchOutlined size={14} />}
          placeholder="搜索前缀 / 构件 / 命名公式"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="规则类型"
          value={ruleType}
          onChange={(value) => setRuleType(value as ComponentNamingRuleType)}
          style={{ width: 160 }}
          options={[
            { value: "component", label: "构件规则" },
            { value: "general", label: "通用总则" },
            { value: "version", label: "版本号规则" },
          ]}
        />
        <Text type="secondary" className="text-xs">
          共 {filtered.length} / {rules.length} 条
        </Text>
      </div>

      <div className="relative mt-3 rounded-md border border-slate-100">
        {loading && rules.length === 0 ? (
          <div className="p-8">
            <ArchLoadingFlow label="正在载入命名规则…" />
          </div>
        ) : (
          <Table
            rowKey="ruleKey"
            columns={columns}
            dataSource={filtered}
            size="middle"
            scroll={{ x: 1000, y: 520 }}
            pagination={false}
          />
        )}
      </div>
    </div>
  );
}

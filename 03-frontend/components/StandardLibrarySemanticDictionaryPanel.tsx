// components/StandardLibrarySemanticDictionaryPanel.tsx - SJG 157 semantic dictionary workbench
// License: Apache-2.0
'use client';

import {
  BookOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { api, type SemanticDictionaryCategory, type SemanticDictionaryStandard } from '@/lib/api';
import type { ModuleAuditEvent } from '@/lib/module-file-system';

const { Text } = Typography;

const groupLabels: Record<SemanticDictionaryCategory['objectGroup'], string> = {
  building: '建筑',
  space: '空间',
  element: '构件',
  system: '系统',
};

const groupColors: Record<SemanticDictionaryCategory['objectGroup'], string> = {
  building: 'green',
  space: 'cyan',
  element: 'blue',
  system: 'purple',
};

export function StandardLibrarySemanticDictionaryPanel({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [standard, setStandard] = useState<SemanticDictionaryStandard | null>(null);
  const [items, setItems] = useState<SemanticDictionaryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [objectGroup, setObjectGroup] = useState<SemanticDictionaryCategory['objectGroup'] | undefined>();
  const [level, setLevel] = useState<number | undefined>();

  const columns = useMemo<ColumnsType<SemanticDictionaryCategory>>(
    () => [
      {
        title: '编码',
        dataIndex: 'code',
        width: 150,
        fixed: 'left',
        render: (code: string) => <Text code>{code}</Text>,
      },
      {
        title: '类目',
        dataIndex: 'nameZh',
        width: 180,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text strong>{row.nameZh}</Text>
            <Text type="secondary">{row.rdfIdentifier}</Text>
          </Space>
        ),
      },
      {
        title: '对象',
        dataIndex: 'objectGroup',
        width: 92,
        render: (value: SemanticDictionaryCategory['objectGroup']) => (
          <Tag color={groupColors[value]}>{groupLabels[value]}</Tag>
        ),
      },
      {
        title: '层级',
        dataIndex: 'levelName',
        width: 88,
        render: (_, row) => `${row.levelNum} · ${row.levelName}`,
      },
      {
        title: '上位类',
        dataIndex: 'parentCode',
        width: 180,
        render: (_, row) =>
          row.parentCode ? (
            <Space direction="vertical" size={0}>
              <Text code>{row.parentCode}</Text>
              <Text type="secondary">{row.parentNameZh}</Text>
            </Space>
          ) : (
            <Text type="secondary">根类目</Text>
          ),
      },
      {
        title: 'IFC 映射',
        dataIndex: 'ifcEntity',
        width: 160,
        render: (value: string | null) => (value ? <Text code>{value}</Text> : <Text type="secondary">/</Text>),
      },
      {
        title: '领域术语/备注',
        dataIndex: 'terminologyRaw',
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.terminologyRaw ?? row.remark ?? ''}>
            <span>{row.remark ?? row.terminologyRaw ?? '/'}</span>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  async function loadCategories(nextOffset = 0) {
    setLoading(true);
    setError(null);
    try {
      const trimmedQuery = query.trim();
      const params: Parameters<typeof api.semanticDictionaries.sjg157.categories>[0] = {
        limit: 50,
        offset: nextOffset,
      };

      if (trimmedQuery) {
        params.q = trimmedQuery;
      }
      if (objectGroup) {
        params.objectGroup = objectGroup;
      }
      if (typeof level === 'number') {
        params.level = level;
      }

      const payload = await api.semanticDictionaries.sjg157.categories(params);
      setStandard(payload.standard);
      setItems(payload.items);
      setTotal(payload.total);
      onAudit?.(
        createModuleAuditEvent(
          'standard-library-sjg157',
          'StandardLibrarySemanticDictionaryPanel',
          `SJG 157 查询: ${payload.items.length}/${payload.total}`,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SJG 157 语义字典接口暂不可用';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectGroup, level]);

  const imported = standard?.ingestionStatus === 'categories_imported' || standard?.ingestionStatus === 'verified';

  return (
    <section className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Space size={10} wrap>
            <Tag color="green" icon={<BookOutlined />}>SJG 157-2024</Tag>
            <Tag color={imported ? 'success' : 'warning'} icon={<DatabaseOutlined />}>
              {imported ? '类目已入库' : '等待类目导入'}
            </Tag>
            <Tag icon={<SafetyCertificateOutlined />}>深圳市住房和建设局</Tag>
          </Space>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">建筑工程信息模型语义字典</h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
            建筑、空间、构件、系统四类对象统一进入标准族库，类目编码、上下位关系、IFC 映射和 RDF 标识由后端语义字典服务提供。
          </p>
        </div>
        <div className="grid min-w-[280px] gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">发布日期</span>
            <Text>{standard?.publishedOn ?? '2024-02-15'}</Text>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">实施日期</span>
            <Text>{standard?.effectiveOn ?? '2024-04-01'}</Text>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">命名空间</span>
            <Text code>{standard?.namespacePrefix ?? 'szbd'}</Text>
          </div>
        </div>
      </div>

      {error ? (
        <Alert className="mt-4" type="warning" showIcon message={error} />
      ) : null}

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={() => void loadCategories()}
          placeholder="编码、类目、IFC、领域术语"
          className="max-w-xl"
        />
        <Select
          allowClear
          value={objectGroup}
          onChange={setObjectGroup}
          placeholder="对象分类"
          className="min-w-36"
          options={[
            { value: 'building', label: '建筑' },
            { value: 'space', label: '空间' },
            { value: 'element', label: '构件' },
            { value: 'system', label: '系统' },
          ]}
        />
        <Select
          allowClear
          value={level}
          onChange={setLevel}
          placeholder="层级"
          className="min-w-32"
          options={[
            { value: 1, label: '1 · 大类' },
            { value: 2, label: '2 · 中类' },
            { value: 3, label: '3 · 小类' },
            { value: 4, label: '4 · 细类' },
            { value: 5, label: '5 · 微类' },
          ]}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => void loadCategories()}>
          查询
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="建筑" value="10" icon={<BranchesOutlined />} />
        <Metric label="空间" value="12" icon={<BranchesOutlined />} />
        <Metric label="构件" value="30" icon={<BranchesOutlined />} />
        <Metric label="系统" value="16" icon={<BranchesOutlined />} />
      </div>

      <Table
        className="mt-4"
        rowKey="code"
        columns={columns}
        dataSource={items}
        loading={loading}
        size="middle"
        scroll={{ x: 1120 }}
        pagination={{
          total,
          pageSize: 50,
          showSizeChanger: false,
          onChange: (page) => void loadCategories((page - 1) * 50),
          showTotal: (value) => `共 ${value} 条`,
        }}
      />
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <Space>
        {icon}
        <span className="text-sm text-slate-500">{label}</span>
      </Space>
      <div className="mt-1 font-mono text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

// components/StandardLibrarySemanticDictionaryPanel.tsx - SJG 157 semantic dictionary explorer
// License: Apache-2.0
'use client';

import {
  BookOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { api, type SemanticDictionaryCategory, type SemanticDictionaryStandard } from '@/lib/api';
import type { LocalFileMetadata } from '@/lib/local-file-runtime';
import type { ModuleAuditEvent } from '@/lib/module-file-system';

const { Text } = Typography;

type ObjectGroup = SemanticDictionaryCategory['objectGroup'];

interface CustomDictionarySource {
  id: string;
  name: string;
  namespacePrefix: string;
  createdAt: string;
}

interface DictionaryExplorerRow {
  key: string;
  kind: 'group' | 'category';
  code: string;
  nameZh: string;
  objectGroup?: ObjectGroup;
  levelNum?: number;
  levelName?: string;
  rdfIdentifier?: string;
  ifcEntity?: string | null;
  terminologyRaw?: string | null;
  remark?: string | null;
  category?: SemanticDictionaryCategory;
  children?: DictionaryExplorerRow[];
}

const groupLabels: Record<ObjectGroup, string> = {
  building: '建筑',
  space: '空间',
  element: '构件',
  system: '系统',
};

const groupTableCodes: Record<ObjectGroup, SemanticDictionaryCategory['tableCode']> = {
  building: '10',
  space: '12',
  element: '30',
  system: '16',
};

const groupColors: Record<ObjectGroup, string> = {
  building: 'green',
  space: 'cyan',
  element: 'blue',
  system: 'purple',
};

const customDictionaryStorageKey =
  'architoken.standard-library.custom-dictionaries.v1';

export function StandardLibrarySemanticDictionaryPanel({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [standard, setStandard] = useState<SemanticDictionaryStandard | null>(null);
  const [allItems, setAllItems] = useState<SemanticDictionaryCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [objectGroup, setObjectGroup] = useState<ObjectGroup | undefined>();
  const [level, setLevel] = useState<number | undefined>();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([
    groupRootKey('building'),
    groupRootKey('space'),
    groupRootKey('element'),
    groupRootKey('system'),
  ]);
  const [uploadedDictionaries, setUploadedDictionaries] = useState<LocalFileMetadata[]>([]);
  const [customDictionaries, setCustomDictionaries] = useState<CustomDictionarySource[]>([]);
  const [customName, setCustomName] = useState('');
  const [customNamespace, setCustomNamespace] = useState('');

  const categoryByCode = useMemo(() => mapCategoriesByCode(allItems), [allItems]);
  const childrenByParent = useMemo(() => mapCategoriesByParent(allItems), [allItems]);
  const filteredItems = useMemo(
    () => filterCategories(allItems, query, objectGroup, level),
    [allItems, level, objectGroup, query],
  );
  const hasFilter = Boolean(query.trim() || objectGroup || level);
  const explorerRows = useMemo(
    () =>
      hasFilter
        ? buildFilteredExplorerRows(filteredItems, categoryByCode, childrenByParent)
        : buildExplorerRows(childrenByParent),
    [categoryByCode, childrenByParent, filteredItems, hasFilter],
  );
  const selectedCategory = selectedCode ? categoryByCode.get(selectedCode) ?? null : null;

  const columns = useMemo<ColumnsType<DictionaryExplorerRow>>(
    () => [
      {
        title: '名称',
        dataIndex: 'nameZh',
        width: 360,
        fixed: 'left',
        render: (_, row) => (
          <Space direction="vertical" size={0} className="min-w-0">
            <Space size={8} className="min-w-0">
              <Text code>{row.code}</Text>
              <Text strong={row.kind === 'category'}>{row.nameZh}</Text>
            </Space>
            {row.rdfIdentifier ? <Text type="secondary">{row.rdfIdentifier}</Text> : null}
          </Space>
        ),
      },
      {
        title: '对象',
        dataIndex: 'objectGroup',
        width: 90,
        render: (value: ObjectGroup | undefined, row) =>
          value ? (
            <Tag color={groupColors[value]}>{groupLabels[value]}</Tag>
          ) : row.kind === 'group' ? (
            <Tag color="green">目录</Tag>
          ) : (
            <Text type="secondary">/</Text>
          ),
      },
      {
        title: '层级',
        dataIndex: 'levelName',
        width: 90,
        render: (_, row) =>
          row.kind === 'category' ? `${row.levelNum} · ${row.levelName}` : '根目录',
      },
      {
        title: '隶属关系',
        dataIndex: 'code',
        width: 360,
        render: (_, row) => {
          if (!row.category) return <Text type="secondary">对象分类根目录</Text>;
          const label = lineageLabel(row.category, categoryByCode);
          return (
            <Tooltip title={label}>
              <span>{label}</span>
            </Tooltip>
          );
        },
      },
      {
        title: 'IFC 映射',
        dataIndex: 'ifcEntity',
        width: 150,
        render: (value: string | null | undefined) =>
          value ? <Text code>{value}</Text> : <Text type="secondary">/</Text>,
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
    [categoryByCode],
  );

  async function loadDictionaryCategories(): Promise<SemanticDictionaryCategory[]> {
    setLoading(true);
    setError(null);
    try {
      const pageSize = 200;
      let offset = 0;
      let expectedTotal = 0;
      const collected: SemanticDictionaryCategory[] = [];
      do {
        const payload = await api.semanticDictionaries.sjg157.categories({
          limit: pageSize,
          offset,
        });
        if (offset === 0) {
          setStandard(payload.standard);
          expectedTotal = payload.total;
        }
        collected.push(...payload.items);
        offset += payload.items.length;
      } while (collected.length < expectedTotal && offset > 0);
      setAllItems(collected);
      onAudit?.(
        createModuleAuditEvent(
          'standard-library-sjg157-tree',
          'StandardLibrarySemanticDictionaryPanel',
          `SJG 157 目录加载: ${collected.length}`,
        ),
      );
      return collected;
    } catch (err) {
      const message = err instanceof Error ? err.message : '语义字典目录加载失败';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const source = allItems.length > 0 ? allItems : await loadDictionaryCategories();
    const matches = filterCategories(source, query, objectGroup, level);
    const first = matches[0];
    if (!first) {
      setSelectedCode(null);
      return;
    }
    setSelectedCode(first.code);
    const sourceMap = mapCategoriesByCode(source);
    setExpandedKeys((current) => mergeKeys(current, expandedKeysFor(first, sourceMap)));
    onAudit?.(
      createModuleAuditEvent(
        'standard-library-sjg157-search',
        'StandardLibrarySemanticDictionaryPanel',
        `SJG 157 搜索定位: ${first.code} ${first.nameZh}`,
      ),
    );
  }

  async function loadDictionarySources() {
    try {
      const response = await fetch('/api/local-files?moduleId=standard_library', {
        cache: 'no-store',
      });
      if (response.ok) {
        const payload = (await response.json()) as { files: LocalFileMetadata[] };
        setUploadedDictionaries(
          payload.files.filter((file) => file.tags.includes('semantic-dictionary')),
        );
      }
    } catch {
      setSourceMessage('本地上传词典索引暂不可用。');
    }
    setCustomDictionaries(readCustomDictionaries());
  }

  async function uploadDictionaryFile(file: File) {
    setUploading(true);
    setSourceMessage(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('moduleId', 'standard_library');
      form.set('owner', '当前用户');
      form.set('tags', 'semantic-dictionary,user-dictionary,standard-library');
      const response = await fetch('/api/local-files/upload', {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }
      await loadDictionarySources();
      setSourceMessage(`${file.name} 已上传并登记为待解析词典。`);
    } catch (err) {
      setSourceMessage(err instanceof Error ? err.message : '词典上传失败');
    } finally {
      setUploading(false);
    }
  }

  function createCustomDictionary() {
    const name = customName.trim();
    if (!name) {
      setSourceMessage('请先输入自定义词典名称。');
      return;
    }
    const source: CustomDictionarySource = {
      id: `custom-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
      name,
      namespacePrefix: customNamespace.trim() || 'custom',
      createdAt: new Date().toISOString(),
    };
    const next = [source, ...customDictionaries].slice(0, 20);
    setCustomDictionaries(next);
    writeCustomDictionaries(next);
    setCustomName('');
    setCustomNamespace('');
    setSourceMessage(`${source.name} 已登记为自定义词典。`);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDictionaryCategories();
      void loadDictionarySources();
    }, 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imported = standard?.ingestionStatus === 'categories_imported' || standard?.ingestionStatus === 'verified';

  return (
    <section className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Space size={10} wrap>
            <Tag color="green" icon={<BookOutlined />}>SJG 157-2024</Tag>
            <Tag color={imported ? 'success' : 'warning'} icon={<DatabaseOutlined />}>
              {imported ? '类目已入库' : '等待类目导入'}
            </Tag>
            <Tag icon={<SafetyCertificateOutlined />}>深圳市住房和建设局</Tag>
            {Object.entries(groupTableCodes).map(([group, tableCode]) => (
              <Tag key={group} color={groupColors[group as ObjectGroup]}>
                {groupLabels[group as ObjectGroup]} {tableCode}
              </Tag>
            ))}
          </Space>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">建筑工程信息模型语义字典</h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
            主区域按资源管理器方式展示语义类目树；查询只作为工具栏过滤、展开和定位。
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

      {error ? <Alert className="mt-4" type="warning" showIcon message={error} /> : null}
      {sourceMessage ? <Alert className="mt-4" type="info" showIcon message={sourceMessage} /> : null}

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={() => void handleSearch()}
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
        <Button type="primary" icon={<SearchOutlined />} onClick={() => void handleSearch()}>
          查询定位
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadDictionaryCategories()} loading={loading}>
          刷新目录
        </Button>
        <Button icon={<UploadOutlined />} loading={uploading} onClick={() => uploadInputRef.current?.click()}>
          上传词典
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          accept=".pdf,.json,.csv,.xlsx,.rdf,.owl,.ttl"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) {
              void uploadDictionaryFile(file);
            }
          }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <Input
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          placeholder="自定义词典名称"
          className="max-w-xs"
        />
        <Input
          value={customNamespace}
          onChange={(event) => setCustomNamespace(event.target.value)}
          placeholder="命名空间，如 corp"
          className="max-w-48"
        />
        <Button icon={<PlusOutlined />} onClick={createCustomDictionary}>
          登记自定义词典
        </Button>
      </div>

      <div className="mt-4 rounded-md border border-slate-100">
        <Table
          rowKey="key"
          columns={columns}
          dataSource={explorerRows}
          loading={loading}
          size="middle"
          scroll={{ x: 1180, y: 560 }}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
          }}
          rowClassName={(row) =>
            row.category?.code === selectedCode ? 'bg-emerald-50/70' : ''
          }
          onRow={(row) => ({
            onClick: () => {
              if (!row.category) return;
              setSelectedCode(row.category.code);
              setExpandedKeys((current) => mergeKeys(current, expandedKeysFor(row.category!, categoryByCode)));
            },
          })}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Tag color="success">
          {allItems.length > 0 ? "SJG 157-2024 已解析 " + allItems.length + " 条" : "SJG 157-2024 目录加载中"}
        </Tag>
        {uploadedDictionaries.map((file) => (
          <Tag key={file.fileId} color="processing">
            {file.originalName} · 待解析
          </Tag>
        ))}
        {customDictionaries.map((source) => (
          <Tag key={source.id} color="default">
            {source.name} · {source.namespacePrefix}
          </Tag>
        ))}
        {selectedCategory ? (
          <span className="ml-auto truncate">
            当前选中: {selectedCategory.code} {lineageLabel(selectedCategory, categoryByCode)}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function buildExplorerRows(
  childrenByParent: Map<string | null, SemanticDictionaryCategory[]>,
): DictionaryExplorerRow[] {
  return (Object.keys(groupLabels) as ObjectGroup[]).map((group) => {
    const roots = sortCategories(
      (childrenByParent.get(null) ?? []).filter((item) => item.objectGroup === group),
    );
    return {
      key: groupRootKey(group),
      kind: 'group',
      code: groupTableCodes[group],
      nameZh: `${groupLabels[group]} ${groupTableCodes[group]}`,
      objectGroup: group,
      children: roots.map((item) => categoryToRow(item, childrenByParent)),
    };
  });
}

function buildFilteredExplorerRows(
  matches: SemanticDictionaryCategory[],
  categoryByCode: Map<string, SemanticDictionaryCategory>,
  fullChildrenByParent: Map<string | null, SemanticDictionaryCategory[]>,
): DictionaryExplorerRow[] {
  const includeCodes = new Set<string>();
  for (const item of matches) {
    let cursor: SemanticDictionaryCategory | undefined = item;
    while (cursor && !includeCodes.has(cursor.code)) {
      includeCodes.add(cursor.code);
      cursor = cursor.parentCode ? categoryByCode.get(cursor.parentCode) : undefined;
    }
  }

  const included = Array.from(includeCodes)
    .map((code) => categoryByCode.get(code))
    .filter((item): item is SemanticDictionaryCategory => Boolean(item));
  const includedChildrenByParent = mapCategoriesByParent(included);

  return (Object.keys(groupLabels) as ObjectGroup[])
    .map((group) => {
      const groupRows = included.filter((item) => item.objectGroup === group);
      const roots = sortCategories(
        groupRows.filter((item) => !item.parentCode || !includeCodes.has(item.parentCode)),
      );
      return {
        key: groupRootKey(group),
        kind: 'group' as const,
        code: groupTableCodes[group],
        nameZh: `${groupLabels[group]} ${groupTableCodes[group]}`,
        objectGroup: group,
        children: roots.map((item) => categoryToRow(item, includedChildrenByParent)),
      };
    })
    .filter((row) => row.children.length > 0 || fullChildrenByParent.has(row.code));
}

function categoryToRow(
  item: SemanticDictionaryCategory,
  childrenByParent: Map<string | null, SemanticDictionaryCategory[]>,
): DictionaryExplorerRow {
  const children = sortCategories(childrenByParent.get(item.code) ?? []).map((child) =>
    categoryToRow(child, childrenByParent),
  );
  return {
    key: categoryKey(item.code),
    kind: 'category',
    code: item.code,
    nameZh: item.nameZh,
    objectGroup: item.objectGroup,
    levelNum: item.levelNum,
    levelName: item.levelName,
    rdfIdentifier: item.rdfIdentifier,
    ifcEntity: item.ifcEntity,
    terminologyRaw: item.terminologyRaw,
    remark: item.remark,
    category: item,
    ...(children.length > 0 ? { children } : {}),
  };
}

function filterCategories(
  items: SemanticDictionaryCategory[],
  query: string,
  objectGroup: ObjectGroup | undefined,
  level: number | undefined,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (objectGroup && item.objectGroup !== objectGroup) return false;
    if (typeof level === 'number' && item.levelNum !== level) return false;
    if (!normalizedQuery) return true;
    return [
      item.code,
      item.nameZh,
      item.rdfIdentifier,
      item.ifcEntity ?? '',
      item.ifcMappingRaw ?? '',
      item.terminologyRaw ?? '',
      item.remark ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function mapCategoriesByCode(items: SemanticDictionaryCategory[]) {
  return new Map(items.map((item) => [item.code, item]));
}

function mapCategoriesByParent(items: SemanticDictionaryCategory[]) {
  const map = new Map<string | null, SemanticDictionaryCategory[]>();
  for (const item of items) {
    const key = item.parentCode ?? null;
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

function sortCategories(items: SemanticDictionaryCategory[]) {
  return [...items].sort((left, right) => left.code.localeCompare(right.code));
}

function lineageLabel(
  row: SemanticDictionaryCategory,
  categoryByCode: Map<string, SemanticDictionaryCategory>,
) {
  const lineage: string[] = [row.nameZh];
  let parentCode = row.parentCode;
  const visited = new Set([row.code]);
  while (parentCode && !visited.has(parentCode)) {
    visited.add(parentCode);
    const parent = categoryByCode.get(parentCode);
    if (!parent) {
      if (row.parentNameZh) {
        lineage.unshift(row.parentNameZh);
      }
      break;
    }
    lineage.unshift(parent.nameZh);
    parentCode = parent.parentCode;
  }
  return lineage.join(' / ');
}

function expandedKeysFor(
  row: SemanticDictionaryCategory,
  categoryByCode: Map<string, SemanticDictionaryCategory>,
) {
  const keys: Key[] = [groupRootKey(row.objectGroup)];
  const ancestors: string[] = [];
  let cursor: SemanticDictionaryCategory | undefined = row;
  const visited = new Set([row.code]);
  while (cursor?.parentCode && !visited.has(cursor.parentCode)) {
    visited.add(cursor.parentCode);
    ancestors.unshift(cursor.parentCode);
    cursor = categoryByCode.get(cursor.parentCode);
  }
  keys.push(...ancestors.map(categoryKey));
  return keys;
}

function mergeKeys(current: Key[], next: Key[]) {
  return Array.from(new Set([...current, ...next]));
}

function groupRootKey(group: ObjectGroup) {
  return `group:${group}`;
}

function categoryKey(code: string) {
  return `category:${code}`;
}

function readCustomDictionaries(): CustomDictionarySource[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(customDictionaryStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomDictionarySource[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.name) : [];
  } catch {
    return [];
  }
}

function writeCustomDictionaries(items: CustomDictionarySource[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(customDictionaryStorageKey, JSON.stringify(items));
}

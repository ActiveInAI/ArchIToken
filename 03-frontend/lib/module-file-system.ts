// lib/module-file-system.ts - Typed mock file system for ArchIToken modules
// License: Apache-2.0

import { activeModuleIds, getModuleSpec, type ModuleId } from './module-registry';
import type { LocalFileMetadata, LocalFileViewerKind } from './local-file-runtime';

export type ModuleFileNodeKind = 'folder' | 'file';
export type ModuleFileStatus =
  | 'active'
  | 'uploaded'
  | 'downloading'
  | 'shared'
  | 'copied'
  | 'moved'
  | 'schema_validating'
  | 'pending_approval'
  | 'soft_deleted'
  | 'archived';

export interface ModuleAuditEvent {
  id: string;
  at: string;
  actor: string;
  summary: string;
}

export interface ModuleFileNode {
  id: string;
  name: string;
  type: ModuleFileNodeKind;
  moduleId: ModuleId;
  parentId: string | null;
  size: number;
  mimeType: string;
  status: ModuleFileStatus;
  version: string;
  owner: string;
  updatedAt: string;
  tags: string[];
  permissions: string[];
  auditTrail: ModuleAuditEvent[];
  source?: 'seed' | 'mock' | 'local_upload';
  localFileId?: string;
  localFile?: LocalFileMetadata;
  viewerKind?: LocalFileViewerKind;
  checksum?: string;
}

export interface ModuleDownloadJob {
  id: string;
  fileId: string;
  fileName: string;
  status: 'queued' | 'ready';
  createdAt: string;
}

export interface ModuleShareLink {
  id: string;
  fileId: string;
  fileName: string;
  url: string;
  createdAt: string;
}

export interface ModuleClipboard {
  sourceFileId: string;
  sourceName: string;
  mode: 'copy';
}

const moduleFolders: Record<ModuleId, string[]> = {
  marketing_service: ['客户线索', '咨询记录', '报价草案', '合同前资料'],
  concept_design: ['场地资料', '方案草图', '风格参考', '指标测算', '展示包'],
  standard_library: ['标准规范', '族库构件', '样板文件', '材质库', '图纸', '模型', '做法库', '规则库', '版本库'],
  detailed_design: ['IFC 模型', 'DWG 图纸', '节点深化', '碰撞检查', '结构连接'],
  quantity_costing: ['工程量', 'BOQ', '成本测算', '价格库', '变更估算'],
  material_logistics: ['库存', '供应商', '价格', '采购计划', '下料单', '包装', '装车', '物流', '签收', '批次'],
  production_manufacturing: ['生产计划', '工序路线', 'CNC', '焊接', '喷涂防腐防火', '质检', 'MES ERP', '构件编码', '包装发运', '返工'],
  construction_supervision: ['施工方案', '进度', '质量', '安全', '日志', 'AR', '360', '三维扫描', '倾斜摄影', '无人机', '建筑机器人', 'IoT', '整改', '竣工资料'],
  digital_twin: ['IFC', 'GLB', '点云', '360', '三维扫描', '倾斜摄影', 'WebGPU 快照'],
  digital_archive: ['项目档案', '图纸档案', '模型档案', '审批记录', '施工日志', '质量安全', '竣工资料', '版本链'],
  settings_center: ['租户设置', '模块开关', '用户角色', '权限策略', '模型路由', '存储适配器', '审计策略'],
};

const sampleExtensions: Record<ModuleId, string[]> = {
  marketing_service: ['.pdf', '.docx', '.json'],
  concept_design: ['.pdf', '.glb', '.png'],
  standard_library: ['.pdf', '.ifc', '.json'],
  detailed_design: ['.ifc', '.dwg', '.bcf'],
  quantity_costing: ['.xlsx', '.csv', '.json'],
  material_logistics: ['.xlsx', '.csv', '.pdf'],
  production_manufacturing: ['.nc', '.dxf', '.pdf'],
  construction_supervision: ['.pdf', '.jpg', '.e57'],
  digital_twin: ['.ifc', '.glb', '.spz'],
  digital_archive: ['.zip', '.pdfa', '.json'],
  settings_center: ['.yaml', '.json', '.md'],
};

const mimeByExtension: Record<string, string> = {
  '.bcf': 'application/bcf',
  '.csv': 'text/csv',
  '.dwg': 'application/acad',
  '.dxf': 'image/vnd.dxf',
  '.e57': 'model/e57',
  '.glb': 'model/gltf-binary',
  '.ifc': 'application/x-step',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.nc': 'text/plain',
  '.pdf': 'application/pdf',
  '.pdfa': 'application/pdf',
  '.png': 'image/png',
  '.spz': 'model/vnd.gaussian-splat',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.yaml': 'application/yaml',
  '.zip': 'application/zip',
};

export function getModuleRootId(moduleId: ModuleId): string {
  return `${moduleId}-root`;
}

export function getModuleFolderNames(moduleId: ModuleId): string[] {
  return moduleFolders[moduleId];
}

export function formatModuleFileSize(size: number): string {
  if (size <= 0) {
    return '-';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

function audit(summary: string): ModuleAuditEvent {
  const at = new Date().toISOString();
  return {
    id: `seed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at,
    actor: 'MockModuleBackendAdapter',
    summary,
  };
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function node(input: Omit<ModuleFileNode, 'auditTrail' | 'permissions' | 'updatedAt' | 'version'> & {
  version?: string;
  updatedAt?: string;
  permissions?: string[];
}): ModuleFileNode {
  return {
    ...input,
    version: input.version ?? 'v1.0',
    updatedAt: input.updatedAt ?? '2026-04-28 09:00',
    permissions: input.permissions ?? ['read', 'write', 'share', 'approve'],
    source: 'seed',
    auditTrail: [audit(`seed ${input.type} ${input.name}`)],
  };
}

function sampleFileName(moduleId: ModuleId, folderName: string, index: number): string {
  const extensions = sampleExtensions[moduleId];
  const extension = extensions[index % extensions.length] ?? '.pdf';
  return `${folderName}-工作文件-${index + 1}${extension}`;
}

export function createInitialModuleFileNodes(): ModuleFileNode[] {
  return activeModuleIds.flatMap((moduleId) => {
    const spec = getModuleSpec(moduleId);
    const rootId = getModuleRootId(moduleId);
    const root = node({
      id: rootId,
      name: spec.zhName,
      type: 'folder',
      moduleId,
      parentId: null,
      size: 0,
      mimeType: 'inode/directory',
      status: 'active',
      owner: 'ArchIToken 平台',
      tags: ['root', spec.track],
    });

    const children = moduleFolders[moduleId].flatMap((folderName, folderIndex) => {
      const folderId = `${moduleId}-${slug(folderName) || `folder-${folderIndex}`}`;
      const folder = node({
        id: folderId,
        name: folderName,
        type: 'folder',
        moduleId,
        parentId: rootId,
        size: 0,
        mimeType: 'inode/directory',
        status: 'active',
        owner: spec.zhName,
        tags: ['folder', spec.track],
      });

      const fileCount = folderIndex === 0 ? 3 : 2;
      const files = Array.from({ length: fileCount }, (_, fileIndex) => {
        const name = sampleFileName(moduleId, folderName, fileIndex);
        const extension = name.slice(name.lastIndexOf('.'));
        return node({
          id: `${folderId}-file-${fileIndex + 1}`,
          name,
          type: 'file',
          moduleId,
          parentId: folderId,
          size: 360_000 + folderIndex * 81_000 + fileIndex * 142_000,
          mimeType: mimeByExtension[extension] ?? 'application/octet-stream',
          status: fileIndex === 0 ? 'active' : 'uploaded',
          owner: spec.zhName,
          tags: [folderName, spec.track, extension.replace('.', '')],
        });
      });

      return [folder, ...files];
    });

    return [root, ...children];
  });
}

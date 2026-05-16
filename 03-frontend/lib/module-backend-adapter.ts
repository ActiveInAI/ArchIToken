// lib/module-backend-adapter.ts - Typed session backend adapter for module workbench
// License: Apache-2.0

import {
  createInitialModuleFileNodes,
  getModuleRootId,
  type ModuleAuditEvent,
  type ModuleClipboard,
  type ModuleDownloadJob,
  type ModuleFileNode,
  type ModuleFileNodeKind,
  type ModuleShareLink,
} from './module-file-system';
import {
  getLocalFileViewerKind,
  type LocalFileMetadata,
  type LocalFileStatus,
} from './local-file-runtime';
import {
  approveModuleTransaction,
  createDefaultModuleTransactions,
  createLifecycleAudit,
  rejectModuleTransaction,
  transitionModuleTransaction,
  type ModuleTransaction,
  type ModuleTransactionEvent,
} from './module-lifecycle';
import type { ModuleId } from './module-registry';

export interface ModuleBackendSnapshot {
  files: ModuleFileNode[];
  uploadedFiles: LocalFileMetadata[];
  transactions: ModuleTransaction[];
  auditEvents: ModuleAuditEvent[];
  clipboard: ModuleClipboard | null;
  downloadJobs: ModuleDownloadJob[];
  shareLinks: ModuleShareLink[];
}

export interface CreateFileInput {
  moduleId: ModuleId;
  parentId: string;
  name: string;
  type: ModuleFileNodeKind;
}

export interface UploadFileInput {
  moduleId: ModuleId;
  parentId: string;
  name: string;
}

export interface CreateTransactionInput {
  moduleId: ModuleId;
  type: string;
  relatedFileIds?: string[];
  relatedArtifactIds?: string[];
}

export interface ModuleBackendAdapter {
  snapshot(moduleId?: ModuleId): ModuleBackendSnapshot;
  listFiles(moduleId: ModuleId, parentId: string): ModuleFileNode[];
  listUploadedFiles(moduleId: ModuleId): LocalFileMetadata[];
  openFile(fileId: string): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  };
  openUploadedFile(fileId: string): {
    metadata: LocalFileMetadata;
    auditEvent: ModuleAuditEvent;
  };
  createFile(input: CreateFileInput): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  };
  uploadFile(input: UploadFileInput): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  };
  uploadLocalFile(
    metadata: LocalFileMetadata,
    parentId: string,
  ): {
    node: ModuleFileNode;
    transaction: ModuleTransaction;
    auditEvent: ModuleAuditEvent;
  };
  downloadFile(fileId: string): {
    job: ModuleDownloadJob;
    auditEvent: ModuleAuditEvent;
  };
  moveFile(
    fileId: string,
    targetParentId: string,
  ): { node: ModuleFileNode; auditEvent: ModuleAuditEvent };
  copyFile(fileId: string): {
    clipboard: ModuleClipboard;
    auditEvent: ModuleAuditEvent;
  };
  pasteFile(
    moduleId: ModuleId,
    targetParentId: string,
  ): { nodes: ModuleFileNode[]; auditEvent: ModuleAuditEvent };
  shareFile(fileId: string): {
    link: ModuleShareLink;
    auditEvent: ModuleAuditEvent;
  };
  deleteFile(fileId: string): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  };
  renameFile(
    fileId: string,
    name: string,
  ): { node: ModuleFileNode; auditEvent: ModuleAuditEvent };
  getProperties(fileId: string): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  };
  createTransaction(input: CreateTransactionInput): {
    transaction: ModuleTransaction;
    auditEvent: ModuleAuditEvent;
  };
  transitionTransaction(
    transactionId: string,
    event: ModuleTransactionEvent,
  ): { transaction: ModuleTransaction; auditEvent: ModuleAuditEvent };
  approveTransaction(
    transactionId: string,
    approver: string,
    comment: string,
  ): { transaction: ModuleTransaction; auditEvent: ModuleAuditEvent };
  rejectTransaction(
    transactionId: string,
    approver: string,
    comment: string,
  ): { transaction: ModuleTransaction; auditEvent: ModuleAuditEvent };
  getUploadedFileMetadata(fileId: string): LocalFileMetadata | null;
  listAuditEvents(moduleId: ModuleId): ModuleAuditEvent[];
}

function nowStamp(): string {
  return new Date().toISOString();
}

function makeAudit(actor: string, summary: string): ModuleAuditEvent {
  const at = nowStamp();
  return {
    id: `module-backend-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at,
    actor,
    summary,
  };
}

function mimeForName(name: string, type: ModuleFileNodeKind): string {
  if (type === 'folder') {
    return 'inode/directory';
  }
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  const map: Record<string, string> = {
    '.3dm': 'model/vnd.3dm',
    '.aac': 'audio/aac',
    '.bcf': 'application/bcf',
    '.brep': 'model/vnd.brep',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.dwg': 'application/acad',
    '.dxf': 'image/vnd.dxf',
    '.e57': 'model/e57',
    '.fbx': 'model/vnd.fbx',
    '.flac': 'audio/flac',
    '.gif': 'image/gif',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.heic': 'image/heic',
    '.ifczip': 'application/x-ifczip',
    '.ifc': 'application/x-step',
    '.iges': 'model/iges',
    '.igs': 'model/iges',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
    '.las': 'application/octet-stream',
    '.m4a': 'audio/mp4',
    '.md': 'text/markdown',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.nc': 'text/plain',
    '.obj': 'model/obj',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.pdfa': 'application/pdf',
    '.ply': 'model/ply',
    '.png': 'image/png',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.rfa': 'application/vnd.autodesk.revit.family',
    '.rtf': 'application/rtf',
    '.rvt': 'application/vnd.autodesk.revit',
    '.skp': 'model/vnd.sketchup.skp',
    '.spz': 'model/vnd.gaussian-splat',
    '.stl': 'model/stl',
    '.step': 'model/step',
    '.stp': 'model/step',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.xls': 'application/vnd.ms-excel',
    '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroenabled.12',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.yaml': 'application/yaml',
    '.zip': 'application/zip',
  };
  return map[extension] ?? 'application/octet-stream';
}

export class SessionModuleBackendAdapter implements ModuleBackendAdapter {
  private files: ModuleFileNode[] = createInitialModuleFileNodes();
  private uploadedFiles: LocalFileMetadata[] = [];
  private transactions: ModuleTransaction[] = createDefaultModuleTransactions();
  private auditEvents: ModuleAuditEvent[] = [];
  private clipboard: ModuleClipboard | null = null;
  private downloadJobs: ModuleDownloadJob[] = [];
  private shareLinks: ModuleShareLink[] = [];

  snapshot(moduleId?: ModuleId): ModuleBackendSnapshot {
    return {
      files: moduleId
        ? this.files.filter((file) => file.moduleId === moduleId)
        : [...this.files],
      uploadedFiles: moduleId
        ? this.uploadedFiles.filter((file) => file.moduleId === moduleId)
        : [...this.uploadedFiles],
      transactions: moduleId
        ? this.transactions.filter(
            (transaction) => transaction.moduleId === moduleId,
          )
        : [...this.transactions],
      auditEvents: moduleId
        ? this.listAuditEvents(moduleId)
        : [...this.auditEvents],
      clipboard: this.clipboard,
      downloadJobs: [...this.downloadJobs],
      shareLinks: [...this.shareLinks],
    };
  }

  listUploadedFiles(moduleId: ModuleId): LocalFileMetadata[] {
    return this.uploadedFiles.filter((file) => file.moduleId === moduleId);
  }

  listFiles(moduleId: ModuleId, parentId: string): ModuleFileNode[] {
    return this.files
      .filter(
        (file) => file.moduleId === moduleId && file.parentId === parentId,
      )
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'folder' ? -1 : 1;
        }
        return left.name.localeCompare(right.name, 'zh-CN');
      });
  }

  openFile(fileId: string): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `打开 ${node.type === 'folder' ? '文件夹' : '文件'} ${node.name}`,
    );
    this.touchFile(fileId, auditEvent);
    return { node: this.requireFile(fileId), auditEvent };
  }

  openUploadedFile(fileId: string): {
    metadata: LocalFileMetadata;
    auditEvent: ModuleAuditEvent;
  } {
    const metadata = this.requireUploadedFile(fileId);
    const auditEvent = this.record(
      metadata.moduleId,
      'LocalFileRuntimeAdapter',
      `查看本地上传文件 ${metadata.originalName}`,
    );
    return { metadata, auditEvent };
  }

  createFile(input: CreateFileInput): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  } {
    const auditEvent = this.record(
      input.moduleId,
      'FileExplorer',
      `新建 ${input.type === 'folder' ? '文件夹' : '文件'} ${input.name}`,
    );
    const node = this.buildNode(
      input.moduleId,
      input.parentId,
      input.name,
      input.type,
      'active',
      auditEvent,
    );
    this.files = [...this.files, node];
    this.touchTransaction(input.moduleId, auditEvent, node.id);
    return { node, auditEvent };
  }

  uploadFile(input: UploadFileInput): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  } {
    const auditEvent = this.record(
      input.moduleId,
      'FileExplorer',
      `上传文件 ${input.name}`,
    );
    const node = this.buildNode(
      input.moduleId,
      input.parentId,
      input.name,
      'file',
      'uploaded',
      auditEvent,
    );
    this.files = [...this.files, node];
    this.touchTransaction(input.moduleId, auditEvent, node.id);
    return { node, auditEvent };
  }

  uploadLocalFile(
    metadata: LocalFileMetadata,
    parentId: string,
  ): {
    node: ModuleFileNode;
    transaction: ModuleTransaction;
    auditEvent: ModuleAuditEvent;
  } {
    const auditEvent = this.record(
      metadata.moduleId,
      'LocalFileRuntimeAdapter',
      `本地上传 ${metadata.originalName}`,
    );
    const node = this.buildNode(
      metadata.moduleId,
      parentId,
      metadata.originalName,
      'file',
      localStatusToFileStatus(metadata.status),
      auditEvent,
      metadata,
    );
    this.files = [
      node,
      ...this.files.filter(
        (file) =>
          file.localFileId !== metadata.fileId &&
          !sameLocalFileContent(file.localFile, metadata, parentId),
      ),
    ];
    this.uploadedFiles = [
      metadata,
      ...this.uploadedFiles.filter(
        (file) =>
          file.fileId !== metadata.fileId &&
          !sameLocalMetadataContent(file, metadata, parentId),
      ),
    ];
    const transaction = this.createUploadTransaction(
      metadata.moduleId,
      metadata.originalName,
      node.id,
      auditEvent,
    );
    this.transactions = [transaction, ...this.transactions];
    this.touchTransaction(metadata.moduleId, auditEvent, node.id);
    return { node, transaction, auditEvent };
  }

  downloadFile(fileId: string): {
    job: ModuleDownloadJob;
    auditEvent: ModuleAuditEvent;
  } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `下载任务已创建 ${node.name}`,
    );
    const job: ModuleDownloadJob = {
      id: `download-${fileId}-${Date.now()}`,
      fileId,
      fileName: node.name,
      status: 'ready',
      createdAt: auditEvent.at,
    };
    this.downloadJobs = [job, ...this.downloadJobs].slice(0, 8);
    this.updateFile(fileId, { status: 'downloading' }, auditEvent);
    return { job, auditEvent };
  }

  moveFile(
    fileId: string,
    targetParentId: string,
  ): { node: ModuleFileNode; auditEvent: ModuleAuditEvent } {
    const node = this.requireFile(fileId);
    const target = this.requireFile(targetParentId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `移动 ${node.name} 到 ${target.name}`,
    );
    this.updateFile(
      fileId,
      { parentId: targetParentId, status: 'moved' },
      auditEvent,
    );
    this.touchTransaction(node.moduleId, auditEvent, fileId);
    return { node: this.requireFile(fileId), auditEvent };
  }

  copyFile(fileId: string): {
    clipboard: ModuleClipboard;
    auditEvent: ModuleAuditEvent;
  } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `复制 ${node.name} 到剪贴板`,
    );
    this.clipboard = {
      sourceFileId: fileId,
      sourceName: node.name,
      mode: 'copy',
    };
    this.updateFile(fileId, { status: 'copied' }, auditEvent);
    return { clipboard: this.clipboard, auditEvent };
  }

  pasteFile(
    moduleId: ModuleId,
    targetParentId: string,
  ): { nodes: ModuleFileNode[]; auditEvent: ModuleAuditEvent } {
    if (!this.clipboard) {
      const auditEvent = this.record(
        moduleId,
        'FileExplorer',
        '粘贴失败: 剪贴板为空',
      );
      return { nodes: [], auditEvent };
    }
    const source = this.requireFile(this.clipboard.sourceFileId);
    const target = this.requireFile(targetParentId);
    const auditEvent = this.record(
      moduleId,
      'FileExplorer',
      `粘贴 ${source.name} 到 ${target.name}`,
    );
    const nodes = this.cloneNodeTree(source, targetParentId, auditEvent);
    this.files = [...this.files, ...nodes];
    this.touchTransaction(moduleId, auditEvent, nodes[0]?.id);
    return { nodes, auditEvent };
  }

  shareFile(fileId: string): {
    link: ModuleShareLink;
    auditEvent: ModuleAuditEvent;
  } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `分享链接已生成 ${node.name}`,
    );
    const link: ModuleShareLink = {
      id: `share-${fileId}-${Date.now()}`,
      fileId,
      fileName: node.name,
      url: `https://architoken.local/share/${node.moduleId}/${fileId}`,
      createdAt: auditEvent.at,
    };
    this.shareLinks = [link, ...this.shareLinks].slice(0, 8);
    this.updateFile(fileId, { status: 'shared' }, auditEvent);
    return { link, auditEvent };
  }

  deleteFile(fileId: string): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `软删除 ${node.name}`,
    );

    if (node.localFileId || node.source === 'local_upload') {
      const deletedNode: ModuleFileNode = {
        ...node,
        status: 'soft_deleted',
        updatedAt: auditEvent.at,
        auditTrail: [auditEvent, ...node.auditTrail].slice(0, 12),
      };
      this.files = this.files.filter((file) => file.id !== fileId);
      if (node.localFileId) {
        this.uploadedFiles = this.uploadedFiles.filter(
          (file) => file.fileId !== node.localFileId,
        );
      }
      this.touchTransaction(node.moduleId, auditEvent, fileId);
      return { node: deletedNode, auditEvent };
    }

    this.updateFile(fileId, { status: 'soft_deleted' }, auditEvent);
    this.touchTransaction(node.moduleId, auditEvent, fileId);
    return { node: this.requireFile(fileId), auditEvent };
  }

  renameFile(
    fileId: string,
    name: string,
  ): { node: ModuleFileNode; auditEvent: ModuleAuditEvent } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `重命名 ${node.name} 为 ${name}`,
    );
    this.updateFile(
      fileId,
      { name, mimeType: mimeForName(name, node.type) },
      auditEvent,
    );
    this.touchTransaction(node.moduleId, auditEvent, fileId);
    return { node: this.requireFile(fileId), auditEvent };
  }

  getProperties(fileId: string): {
    node: ModuleFileNode;
    auditEvent: ModuleAuditEvent;
  } {
    const node = this.requireFile(fileId);
    const auditEvent = this.record(
      node.moduleId,
      'FileExplorer',
      `查看属性 ${node.name}`,
    );
    this.touchFile(fileId, auditEvent);
    return { node: this.requireFile(fileId), auditEvent };
  }

  createTransaction(input: CreateTransactionInput): {
    transaction: ModuleTransaction;
    auditEvent: ModuleAuditEvent;
  } {
    const auditEvent = this.record(
      input.moduleId,
      'Lifecycle',
      `创建事务 ${input.type}`,
    );
    const transaction: ModuleTransaction = {
      id: `${input.moduleId}-txn-${Date.now()}`,
      moduleId: input.moduleId,
      type: input.type,
      status: 'open',
      currentState: 'draft',
      actor: 'Lifecycle',
      createdAt: auditEvent.at,
      updatedAt: auditEvent.at,
      relatedFileIds: input.relatedFileIds ?? [getModuleRootId(input.moduleId)],
      relatedArtifactIds: input.relatedArtifactIds ?? [],
      approvals: [
        {
          id: `${input.moduleId}-approval-${Date.now()}`,
          approver: '业务负责人',
          status: 'pending',
          comment: '等待审批。',
          updatedAt: auditEvent.at,
        },
      ],
      auditTrail: [auditEvent],
    };
    this.transactions = [transaction, ...this.transactions];
    return { transaction, auditEvent };
  }

  transitionTransaction(
    transactionId: string,
    event: ModuleTransactionEvent,
  ): { transaction: ModuleTransaction; auditEvent: ModuleAuditEvent } {
    const transaction = this.requireTransaction(transactionId);
    const updated = transitionModuleTransaction(transaction, event);
    const auditEvent =
      updated.auditTrail[0] ?? createLifecycleAudit('Lifecycle', `${event}`);
    this.replaceTransaction(updated);
    this.auditEvents = [auditEvent, ...this.auditEvents].slice(0, 80);
    return { transaction: updated, auditEvent };
  }

  approveTransaction(
    transactionId: string,
    approver: string,
    comment: string,
  ): { transaction: ModuleTransaction; auditEvent: ModuleAuditEvent } {
    const transaction = this.requireTransaction(transactionId);
    const updated = approveModuleTransaction(transaction, approver, comment);
    const auditEvent =
      updated.auditTrail[0] ?? createLifecycleAudit(approver, 'approve');
    this.replaceTransaction(updated);
    this.auditEvents = [auditEvent, ...this.auditEvents].slice(0, 80);
    return { transaction: updated, auditEvent };
  }

  rejectTransaction(
    transactionId: string,
    approver: string,
    comment: string,
  ): { transaction: ModuleTransaction; auditEvent: ModuleAuditEvent } {
    const transaction = this.requireTransaction(transactionId);
    const updated = rejectModuleTransaction(transaction, approver, comment);
    const auditEvent =
      updated.auditTrail[0] ?? createLifecycleAudit(approver, 'reject');
    this.replaceTransaction(updated);
    this.auditEvents = [auditEvent, ...this.auditEvents].slice(0, 80);
    return { transaction: updated, auditEvent };
  }

  getUploadedFileMetadata(fileId: string): LocalFileMetadata | null {
    return this.uploadedFiles.find((file) => file.fileId === fileId) ?? null;
  }

  listAuditEvents(moduleId: ModuleId): ModuleAuditEvent[] {
    const transactionEvents = this.transactions
      .filter((transaction) => transaction.moduleId === moduleId)
      .flatMap((transaction) => transaction.auditTrail);
    const fileEvents = this.files
      .filter((file) => file.moduleId === moduleId)
      .flatMap((file) => file.auditTrail);
    return [...this.auditEvents, ...transactionEvents, ...fileEvents]
      .filter(
        (event, index, events) =>
          events.findIndex((item) => item.id === event.id) === index,
      )
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, 60);
  }

  private buildNode(
    moduleId: ModuleId,
    parentId: string,
    name: string,
    type: ModuleFileNodeKind,
    status: ModuleFileNode['status'],
    auditEvent: ModuleAuditEvent,
    localFile?: LocalFileMetadata,
  ): ModuleFileNode {
    const node: ModuleFileNode = {
      id: localFile
        ? `uploaded-${localFile.fileId}`
        : `${moduleId}-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      type,
      moduleId,
      parentId,
      size: localFile?.size ?? (type === 'folder' ? 0 : 512_000),
      mimeType: localFile?.mimeType ?? mimeForName(name, type),
      status,
      version: 'v1.0',
      owner: localFile?.owner ?? '当前用户',
      updatedAt: auditEvent.at,
      tags: localFile?.tags ?? [type, status],
      permissions: ['read', 'write', 'share', 'approve'],
      source: localFile ? 'local_upload' : 'session',
      auditTrail: [auditEvent],
    };

    if (!localFile) {
      return node;
    }

    return {
      ...node,
      localFileId: localFile.fileId,
      localFile,
      viewerKind: getLocalFileViewerKind(localFile),
      checksum: localFile.checksum,
    };
  }

  private createUploadTransaction(
    moduleId: ModuleId,
    fileName: string,
    fileId: string,
    auditEvent: ModuleAuditEvent,
  ): ModuleTransaction {
    let transaction: ModuleTransaction = {
      id: `${moduleId}-upload-${Date.now()}`,
      moduleId,
      type: `本地文件导入: ${fileName}`,
      status: 'open',
      currentState: 'draft',
      actor: 'LocalFileRuntimeAdapter',
      createdAt: auditEvent.at,
      updatedAt: auditEvent.at,
      relatedFileIds: [fileId],
      relatedArtifactIds: [],
      approvals: [
        {
          id: `${moduleId}-upload-approval-${Date.now()}`,
          approver: '模块负责人',
          status: 'pending',
          comment: '本地上传文件已进入 Schema 校验与导入审批。',
          updatedAt: auditEvent.at,
        },
      ],
      auditTrail: [auditEvent],
    };

    (
      [
        'submit',
        'generate',
        'evaluate',
        'rule_check',
        'validate_schema',
        'request_approval',
      ] as const
    ).forEach((event) => {
      transaction = transitionModuleTransaction(
        transaction,
        event,
        'LocalFileRuntimeAdapter',
      );
    });
    return transaction;
  }

  private cloneNodeTree(
    source: ModuleFileNode,
    targetParentId: string,
    auditEvent: ModuleAuditEvent,
  ): ModuleFileNode[] {
    const cloneId = `${source.id}-copy-${Date.now()}`;
    const clone: ModuleFileNode = {
      ...source,
      id: cloneId,
      parentId: targetParentId,
      name: `${source.name} 副本`,
      status: 'copied',
      updatedAt: auditEvent.at,
      auditTrail: [auditEvent, ...source.auditTrail].slice(0, 12),
    };

    if (source.type === 'file') {
      return [clone];
    }

    const descendants = this.files.filter(
      (file) => file.parentId === source.id,
    );
    return [
      clone,
      ...descendants.flatMap((child) =>
        this.cloneNodeTree(child, cloneId, auditEvent),
      ),
    ];
  }

  private record(
    moduleId: ModuleId,
    actor: string,
    summary: string,
  ): ModuleAuditEvent {
    const auditEvent = makeAudit(actor, summary);
    this.auditEvents = [auditEvent, ...this.auditEvents].slice(0, 80);
    this.touchTransaction(moduleId, auditEvent);
    return auditEvent;
  }

  private touchFile(fileId: string, auditEvent: ModuleAuditEvent) {
    this.files = this.files.map((file) =>
      file.id === fileId
        ? {
            ...file,
            updatedAt: auditEvent.at,
            auditTrail: [auditEvent, ...file.auditTrail].slice(0, 12),
          }
        : file,
    );
  }

  private updateFile(
    fileId: string,
    patch: Partial<ModuleFileNode>,
    auditEvent: ModuleAuditEvent,
  ) {
    this.files = this.files.map((file) =>
      file.id === fileId
        ? {
            ...file,
            ...patch,
            updatedAt: auditEvent.at,
            auditTrail: [auditEvent, ...file.auditTrail].slice(0, 12),
          }
        : file,
    );
  }

  private touchTransaction(
    moduleId: ModuleId,
    auditEvent: ModuleAuditEvent,
    relatedFileId?: string,
  ) {
    const transaction = this.transactions.find(
      (item) => item.moduleId === moduleId,
    );
    if (!transaction) {
      return;
    }
    const relatedFileIds =
      relatedFileId && !transaction.relatedFileIds.includes(relatedFileId)
        ? [relatedFileId, ...transaction.relatedFileIds]
        : transaction.relatedFileIds;
    this.replaceTransaction({
      ...transaction,
      updatedAt: auditEvent.at,
      relatedFileIds,
      auditTrail: [auditEvent, ...transaction.auditTrail].slice(0, 16),
    });
  }

  private replaceTransaction(transaction: ModuleTransaction) {
    this.transactions = this.transactions.map((item) =>
      item.id === transaction.id ? transaction : item,
    );
  }

  private requireFile(fileId: string): ModuleFileNode {
    const node = this.files.find((file) => file.id === fileId);
    if (!node) {
      throw new Error(`Unknown file: ${fileId}`);
    }
    return node;
  }

  private requireUploadedFile(fileId: string): LocalFileMetadata {
    const metadata = this.uploadedFiles.find((file) => file.fileId === fileId);
    if (!metadata) {
      throw new Error(`Unknown uploaded file: ${fileId}`);
    }
    return metadata;
  }

  private requireTransaction(transactionId: string): ModuleTransaction {
    const transaction = this.transactions.find(
      (item) => item.id === transactionId,
    );
    if (!transaction) {
      throw new Error(`Unknown transaction: ${transactionId}`);
    }
    return transaction;
  }
}

export const moduleBackendAdapter = new SessionModuleBackendAdapter();

function sameLocalFileContent(
  left: LocalFileMetadata | undefined,
  right: LocalFileMetadata,
  parentId: string,
): boolean {
  if (!left) {
    return false;
  }
  return sameLocalMetadataContent(left, right, parentId);
}

function sameLocalMetadataContent(
  left: LocalFileMetadata,
  right: LocalFileMetadata,
  parentId: string,
): boolean {
  return (
    left.moduleId === right.moduleId &&
    (left.parentId ?? parentId) === parentId &&
    (right.parentId ?? parentId) === parentId &&
    left.originalName === right.originalName &&
    left.size === right.size &&
    left.checksum === right.checksum
  );
}

function localStatusToFileStatus(
  status: LocalFileStatus,
): ModuleFileNode['status'] {
  if (status === 'schema_validating') {
    return 'schema_validating';
  }
  if (status === 'pending_approval') {
    return 'pending_approval';
  }
  if (status === 'archived') {
    return 'archived';
  }
  return 'uploaded';
}

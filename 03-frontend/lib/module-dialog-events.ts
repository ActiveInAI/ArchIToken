// lib/module-dialog-events.ts - Browser events shared by module dialog and file workbench
// License: Apache-2.0

import type { ModuleId } from "./module-registry";
import type { LocalFileMetadata } from "./local-file-runtime";
import type { ModuleAuditEvent, ModuleFileNode } from "./module-file-system";

export const architokenOpenFileEventName = "architoken:open-file";
export const architokenPendingOpenFileKey = "architoken.pendingOpenFile";
export const architokenFolderSelectionEventName =
  "architoken:module-folder-selection";
export const architokenPendingFolderSelectionKey =
  "architoken.pendingFolderSelection";
export const architokenModuleFileTreeChangedEventName =
  "architoken:module-file-tree-changed";
export const architokenPlanningProjectSelectionEventName =
  "architoken:planning-project-selection";
export const architokenPendingPlanningProjectSelectionKey =
  "architoken.pendingPlanningProjectSelection";
export const architokenLocalFileChangedEventName =
  "architoken:local-file-changed";
export const architokenPanAIHostFileCreatedEventName =
  "architoken:panai-host-file-created";

export interface ArchitokenOpenFileRequest {
  fileId: string;
  moduleId: ModuleId;
  query: string;
  requestedAt: string;
}

export interface ArchitokenFolderSelectionRequest {
  folderId: string;
  moduleId: ModuleId;
  requestedAt: string;
}

export interface ArchitokenModuleFileTreeChangedRequest {
  activeFolderId?: string | undefined;
  moduleId: ModuleId;
  requestedAt: string;
}

export interface ArchitokenPlanningProjectSelectionRequest {
  projectId: string;
  projectName: string;
  folderId: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  location?: string | undefined;
  stage?: string | undefined;
  requestedAt: string;
}

export interface ArchitokenLocalFileChangedRequest {
  file: LocalFileMetadata;
  reason: "native-session-commit" | "inline-edit" | "office-saveback";
  requestedAt: string;
}

export interface ArchitokenPanAIHostFileCreatedRequest {
  seq: number;
  moduleId: ModuleId;
  parentId: string;
  node: ModuleFileNode;
  auditEvent: ModuleAuditEvent;
  message: string;
  requestedAt: string;
}

// lib/module-dialog-events.ts - Browser events shared by module dialog and file workbench
// License: Apache-2.0

import type { ModuleId } from './module-registry';

export const architokenOpenFileEventName = 'architoken:open-file';
export const architokenPendingOpenFileKey = 'architoken.pendingOpenFile';

export interface ArchitokenOpenFileRequest {
  fileId: string;
  moduleId: ModuleId;
  query: string;
  requestedAt: string;
}

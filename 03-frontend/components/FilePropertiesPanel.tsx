// components/FilePropertiesPanel.tsx - File properties inspector
// License: Apache-2.0
'use client';

import { Info, ShieldCheck } from 'lucide-react';
import type { ModuleFileNode, ModuleShareLink } from '@/lib/module-file-system';
import { formatModuleFileSize } from '@/lib/module-file-system';

export function FilePropertiesPanel({
  file,
  shareLinks,
}: {
  file: ModuleFileNode | null;
  shareLinks: ModuleShareLink[];
}) {
  if (!file) {
    return (
      <section className="arch-card rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Info className="arch-primary-text h-4 w-4" />
          <h3 className="font-black">属性面板</h3>
        </div>
        <p className="arch-muted mt-3 text-sm leading-6">
          左键选择文件或文件夹后,这里会显示属性、权限、版本、标签和分享链接。
        </p>
      </section>
    );
  }

  const links = shareLinks.filter((link) => link.fileId === file.id);

  return (
    <section className="arch-card rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="arch-primary-text font-mono text-[10px]">
            Properties
          </p>
          <h3 className="mt-1 truncate text-xl font-black">{file.name}</h3>
        </div>
        <ShieldCheck className="arch-primary-text h-5 w-5" />
      </div>

      <div className="mt-4 space-y-2">
        <PropertyRow label="类型" value={file.type} />
        <PropertyRow label="状态" value={file.status} />
        <PropertyRow label="大小" value={formatModuleFileSize(file.size)} />
        <PropertyRow label="MIME" value={file.mimeType} />
        <PropertyRow label="版本" value={file.version} />
        <PropertyRow label="所有者" value={file.owner} />
        <PropertyRow label="更新时间" value={file.updatedAt} />
      </div>

      <div className="mt-4">
        <p className="arch-primary-text mb-2 text-xs font-black">标签</p>
        <div className="flex flex-wrap gap-2">
          {file.tags.map((tag) => (
            <span key={tag} className="arch-chip rounded-full border px-2 py-1 text-[10px] font-black">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="arch-primary-text mb-2 text-xs font-black">权限</p>
        <div className="grid grid-cols-2 gap-2">
          {file.permissions.map((permission) => (
            <span key={permission} className="arch-card-muted rounded-lg px-2 py-1 text-xs">
              {permission}
            </span>
          ))}
        </div>
      </div>

      {links.length > 0 ? (
        <div className="mt-4">
          <p className="arch-primary-text mb-2 text-xs font-black">分享链接</p>
          {links.map((link) => (
            <p key={link.id} className="arch-card-muted break-all rounded-lg px-3 py-2 text-xs leading-5">
              {link.url}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="arch-card-muted flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs">
      <span className="arch-muted">{label}</span>
      <span className="arch-text max-w-[68%] break-words text-right font-bold">{value}</span>
    </div>
  );
}

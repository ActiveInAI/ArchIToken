// lib/office-preview-policy.ts - Layout-preserving Office preview policy
// License: Apache-2.0

export type OfficePreviewFamily =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "drawing"
  | "database"
  | "ofd";

const officePreviewExtensions: Record<OfficePreviewFamily, readonly string[]> = {
  document: [".doc", ".docx", ".odt", ".rtf"],
  spreadsheet: [".xls", ".xlsx", ".xlsm", ".xlsb", ".ods"],
  presentation: [".ppt", ".pptx", ".pptm", ".pps", ".ppsx", ".odp"],
  drawing: [".odg"],
  database: [".odb"],
  ofd: [".ofd"],
};

export function officePreviewFamilyForExtension(
  extension: string,
): OfficePreviewFamily | null {
  const normalized = normalizeOfficeExtension(extension);
  for (const [family, extensions] of Object.entries(officePreviewExtensions)) {
    if (extensions.includes(normalized)) {
      return family as OfficePreviewFamily;
    }
  }
  return null;
}

export function prefersNativeOfficePdf(extension: string): boolean {
  void extension;
  return false;
}

export function requiresLayoutPreservingOfficePreview(
  extension: string,
): boolean {
  const family = officePreviewFamilyForExtension(extension);
  return Boolean(
    family &&
      family !== "database" &&
      family !== "ofd",
  );
}

export function canPreviewOfficeInBrowser(extension: string): boolean {
  const normalized = normalizeOfficeExtension(extension);
  const family = officePreviewFamilyForExtension(normalized);
  if (family === "spreadsheet") return true;
  if (normalized === ".docx") return true;
  return [".pptx", ".pptm", ".ppsx"].includes(normalized);
}

export function officePdfExportFilter(extension: string): string {
  const family = officePreviewFamilyForExtension(extension);
  if (family === "spreadsheet") return "pdf:calc_pdf_Export";
  if (family === "presentation") return "pdf:impress_pdf_Export";
  if (family === "drawing") return "pdf:draw_pdf_Export";
  if (family === "database" || family === "ofd") {
    throw new Error(
      `${extension || "该格式"} 没有登记为 LibreOffice PDF 派生路线；必须使用原生 runtime/adapter 打开。`,
    );
  }
  return "pdf:writer_pdf_Export";
}

export function officeNativePreviewRequiredMessage(extension: string): string {
  const family = officePreviewFamilyForExtension(extension);
  if (family === "spreadsheet") {
    return "电子表格默认以 Office 工作簿结构打开；如需核对打印区域、分页、方向、缩放、行列尺寸、合并单元格和源文件幅面，可切换到 PanAEC Engine/LibreOffice/Office 生成的原版式 PDF 派生。";
  }
  if (family === "presentation") {
    return "演示文稿默认以 Office 幻灯片结构打开；如需核对母版、字体、图片、图层、页面比例和版式位置，可切换到 PanAEC Engine/LibreOffice/Office 生成的原版式 PDF 派生。";
  }
  if (family === "document") {
    return "Office 文档默认以 Office 文档结构打开；如需核对页边距、分页、字体、图片和对象位置，可切换到 PanAEC Engine/LibreOffice/Office 生成的原版式 PDF 派生。";
  }
  if (family === "drawing") {
    return "ODF 图形文档默认优先通过 Collabora WOPI/Draw 原生打开；PDF、SVG 或图片只能作为派生或导出。";
  }
  if (family === "database") {
    return "ODB 是 ODF 数据库源文件，必须通过支持 ODB 的原生数据库/Office runtime 打开；不得把导出的表格、PDF、HTML 或截图当作 ODB 原生显示。";
  }
  if (family === "ofd") {
    return "OFD 必须通过支持 GB/T 33190-2016 的原生 OFD runtime 打开；Collabora 只有在 discovery 明确声明 OFD 动作时才能作为优先原生路线，PDF、图片、OCR 或文本抽取只能作为派生。";
  }
  return `${extension || "该 Office 格式"} 需要接入 Office 原生解析/编辑服务后才能打开；PDF 只能作为版式派生，不能替代 Office 源格式支持。`;
}

function normalizeOfficeExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

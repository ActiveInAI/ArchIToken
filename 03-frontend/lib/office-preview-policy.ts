// lib/office-preview-policy.ts - Layout-preserving Office preview policy
// License: Apache-2.0

export type OfficePreviewFamily = "document" | "spreadsheet" | "presentation";

const officePreviewExtensions: Record<OfficePreviewFamily, readonly string[]> = {
  document: [".doc", ".docx", ".odt", ".rtf"],
  spreadsheet: [".xls", ".xlsx", ".xlsm", ".xlsb", ".ods"],
  presentation: [".ppt", ".pptx", ".pptm", ".pps", ".ppsx", ".odp"],
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
  return officePreviewFamilyForExtension(extension) !== null;
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
  return "pdf:writer_pdf_Export";
}

export function officeNativePreviewRequiredMessage(extension: string): string {
  const family = officePreviewFamilyForExtension(extension);
  if (family === "spreadsheet") {
    return "电子表格默认以 Office 工作簿结构打开；如需核对打印区域、分页、方向、缩放、行列尺寸、合并单元格和源文件幅面，可切换到 Prengine/LibreOffice/Office 生成的原版式 PDF 派生。";
  }
  if (family === "presentation") {
    return "演示文稿默认以 Office 幻灯片结构打开；如需核对母版、字体、图片、图层、页面比例和版式位置，可切换到 Prengine/LibreOffice/Office 生成的原版式 PDF 派生。";
  }
  if (family === "document") {
    return "Office 文档默认以 Office 文档结构打开；如需核对页边距、分页、字体、图片和对象位置，可切换到 Prengine/LibreOffice/Office 生成的原版式 PDF 派生。";
  }
  return `${extension || "该 Office 格式"} 需要接入 Office 原生解析/编辑服务后才能打开；PDF 只能作为版式派生，不能替代 Office 源格式支持。`;
}

function normalizeOfficeExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

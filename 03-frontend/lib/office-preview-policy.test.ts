// lib/office-preview-policy.test.ts - Office preview policy tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  canPreviewOfficeInBrowser,
  officeNativePreviewRequiredMessage,
  officePdfExportFilter,
  officePreviewFamilyForExtension,
  prefersNativeOfficePdf,
  requiresLayoutPreservingOfficePreview,
} from "./office-preview-policy";

describe("office preview policy", () => {
  it("does not force native PDF as the default Office view", () => {
    for (const extension of [".xlsx", ".xls", ".xlsm", ".pptx", ".ppt"]) {
      expect(prefersNativeOfficePdf(extension)).toBe(false);
      expect(requiresLayoutPreservingOfficePreview(extension)).toBe(true);
    }
  });

  it("allows browser-native structure previews for supported Office families", () => {
    expect(prefersNativeOfficePdf(".docx")).toBe(false);
    expect(canPreviewOfficeInBrowser(".docx")).toBe(true);
    expect(canPreviewOfficeInBrowser(".xlsx")).toBe(true);
    expect(canPreviewOfficeInBrowser(".xls")).toBe(true);
    expect(canPreviewOfficeInBrowser(".pptx")).toBe(true);
    expect(canPreviewOfficeInBrowser(".doc")).toBe(false);
    expect(canPreviewOfficeInBrowser(".ppt")).toBe(false);
  });

  it("maps Office families to LibreOffice PDF export filters", () => {
    expect(officePreviewFamilyForExtension("xlsx")).toBe("spreadsheet");
    expect(officePreviewFamilyForExtension(".pptx")).toBe("presentation");
    expect(officePreviewFamilyForExtension(".docx")).toBe("document");
    expect(officePdfExportFilter(".xlsx")).toBe("pdf:calc_pdf_Export");
    expect(officePdfExportFilter(".pptx")).toBe("pdf:impress_pdf_Export");
    expect(officePdfExportFilter(".docx")).toBe("pdf:writer_pdf_Export");
  });

  it("explains that PDF is an optional layout derivative, not the default", () => {
    expect(officeNativePreviewRequiredMessage(".xlsx")).toContain("打印区域");
    expect(officeNativePreviewRequiredMessage(".xlsx")).toContain("幅面");
    expect(officeNativePreviewRequiredMessage(".xlsx")).toContain("默认");
    expect(officeNativePreviewRequiredMessage(".pptx")).toContain("母版");
    expect(officeNativePreviewRequiredMessage(".pptx")).toContain("PDF 派生");
  });
});

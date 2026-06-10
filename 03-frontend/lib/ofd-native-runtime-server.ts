// lib/ofd-native-runtime-server.ts - PanAEC native OFD package runtime
// License: Apache-2.0

import { readFile } from "node:fs/promises";
import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import type { LocalFileMetadata } from "./local-file-runtime";

export interface OfdNativeEntry {
  path: string;
  kind:
    | "ofd-root"
    | "document"
    | "page"
    | "resource"
    | "signature"
    | "annotation"
    | "attachment"
    | "xml"
    | "data";
  directory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  modifiedAt: string | null;
}

export interface OfdNativeTextSnippet {
  path: string;
  text: string;
}

export interface OfdNativeRenderedText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontId: string | null;
  fontFamily: string;
  fontSize: number;
  fill: string;
}

export interface OfdNativeRenderedPage {
  id: string;
  sourcePath: string;
  width: number;
  height: number;
  objects: OfdNativeRenderedText[];
}

export interface OfdNativeManifest {
  schema: "architoken.ofd_native_manifest.v1";
  fileId: string;
  originalName: string;
  sourceFormat: "ofd";
  sourceChecksum: string;
  standard: "GB/T 33190-2016";
  engine: "PanAEC Engine OFD Native";
  viewer: "ofd_native_package_viewer" | "ofd_native_adapter_required";
  sourceOfRecord: {
    url: string;
    checksum: string;
    substitutePreview: false;
  };
  nativeRoute: "panaec-ofd-package-reader";
  derivativeRoles: [];
  canRenderFixedLayout: boolean;
  nativeAdapterRequired: boolean;
  renderedPages: OfdNativeRenderedPage[];
  entries: OfdNativeEntry[];
  documents: string[];
  pages: string[];
  resources: string[];
  signatures: string[];
  annotations: string[];
  attachments: string[];
  textSnippets: OfdNativeTextSnippet[];
  notes: string[];
}

export class OfdNativeRuntimeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function buildOfdNativeManifest(
  fileId: string,
  requestUrl: string,
): Promise<OfdNativeManifest> {
  const metadata = await requireOfdMetadata(fileId);
  const bytes = await readFile(resolveLocalUploadStoragePath(metadata));
  const origin = publicOriginFromRequest(requestUrl);
  const sourceUrl = `${origin}/api/local-files/${encodeURIComponent(metadata.fileId)}`;
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new OfdNativeRuntimeError(
      422,
      "ofd_package_parse_failed",
      `OFD 源文件不是可读取的 GB/T 33190-2016 包结构: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { fileId: metadata.fileId, extension: metadata.ext },
    );
  }

  const entries = collectOfdEntries(zip);
  const documents = entries
    .filter((entry) => entry.kind === "document")
    .map((entry) => entry.path);
  const pages = entries
    .filter((entry) => entry.kind === "page")
    .map((entry) => entry.path);
  const resources = entries
    .filter((entry) => entry.kind === "resource")
    .map((entry) => entry.path);
  const signatures = entries
    .filter((entry) => entry.kind === "signature")
    .map((entry) => entry.path);
  const annotations = entries
    .filter((entry) => entry.kind === "annotation")
    .map((entry) => entry.path);
  const attachments = entries
    .filter((entry) => entry.kind === "attachment")
    .map((entry) => entry.path);
  const textSnippets = await extractOfdTextSnippets(zip, entries);
  const renderedPages = await buildOfdRenderedPages(zip, documents);
  const hasRoot = entries.some((entry) => entry.kind === "ofd-root");
  const hasDocument = documents.length > 0;

  return {
    schema: "architoken.ofd_native_manifest.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    sourceFormat: "ofd",
    sourceChecksum: metadata.checksum,
    standard: "GB/T 33190-2016",
    engine: "PanAEC Engine OFD Native",
    viewer:
      hasRoot && hasDocument
        ? "ofd_native_package_viewer"
        : "ofd_native_adapter_required",
    sourceOfRecord: {
      url: sourceUrl,
      checksum: metadata.checksum,
      substitutePreview: false,
    },
    nativeRoute: "panaec-ofd-package-reader",
    derivativeRoles: [],
    canRenderFixedLayout: renderedPages.length > 0,
    nativeAdapterRequired: true,
    renderedPages,
    entries,
    documents,
    pages,
    resources,
    signatures,
    annotations,
    attachments,
    textSnippets,
    notes: [
      "This route opens the OFD source package directly and does not create PDF/image/OCR/text derivatives.",
      "Collabora remains the preferred native WOPI route only when its live discovery document advertises OFD.",
      "PanAEC renders the page from OFD XML text objects when available; digital seal validation and invoice semantics still require a GB/T 33190-2016 OFD runtime adapter.",
      ...(hasRoot ? [] : ["OFD.xml was not found in the source package."]),
      ...(hasDocument
        ? []
        : ["Document.xml was not found in the source package."]),
    ],
  };
}

async function requireOfdMetadata(fileId: string): Promise<LocalFileMetadata> {
  const metadata = await getLocalFileMetadata(fileId);
  if (!metadata) {
    throw new OfdNativeRuntimeError(404, "file_not_found", "file not found", {
      fileId,
    });
  }
  if (metadata.ext.trim().toLowerCase() !== ".ofd") {
    throw new OfdNativeRuntimeError(
      415,
      "unsupported_ofd_format",
      `Unsupported OFD format: ${metadata.ext || metadata.mimeType}`,
      { extension: metadata.ext, mimeType: metadata.mimeType },
    );
  }
  return metadata;
}

async function buildOfdRenderedPages(
  zip: JSZip,
  documents: string[],
): Promise<OfdNativeRenderedPage[]> {
  const renderedPages: OfdNativeRenderedPage[] = [];

  for (const documentPath of documents) {
    const documentEntry = zip.file(documentPath);
    if (!documentEntry) continue;
    const documentXml = await documentEntry.async("text");
    const document = parseXml(documentXml);
    const pageArea = parseDocumentPageArea(document);
    const documentBase = dirnameOfdPath(documentPath);
    const fonts = await parseDocumentFonts(zip, document, documentBase);
    const pageRefs = elementsByLocalName(document, "Page")
      .map((page) => ({
        id: page.getAttribute("ID") || page.getAttribute("id") || "page",
        path: resolveOfdPath(documentBase, page.getAttribute("BaseLoc") || ""),
      }))
      .filter((page) => page.path);

    for (const pageRef of pageRefs) {
      const pageEntry = zip.file(pageRef.path);
      if (!pageEntry) continue;
      const pageXml = await pageEntry.async("text");
      const pageDocument = parseXml(pageXml);
      const objects = parsePageTextObjects(pageDocument, fonts);
      renderedPages.push({
        id: pageRef.id,
        sourcePath: pageRef.path,
        width: pageArea.width,
        height: pageArea.height,
        objects,
      });
    }
  }

  return renderedPages;
}

function parseDocumentPageArea(document: Document): {
  width: number;
  height: number;
} {
  const physicalBox = firstTextByLocalName(document, "PhysicalBox");
  const values = parseNumberList(physicalBox);
  const width = values[2];
  const height = values[3];
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return { width, height };
  }
  return { width: 210, height: 297 };
}

async function parseDocumentFonts(
  zip: JSZip,
  document: Document,
  documentBase: string,
): Promise<Map<string, string>> {
  const fonts = new Map<string, string>();
  const publicResPaths = elementsByLocalName(document, "PublicRes")
    .map((node) => resolveOfdPath(documentBase, node.textContent?.trim() ?? ""))
    .filter(Boolean);

  for (const publicResPath of publicResPaths) {
    const entry = zip.file(publicResPath);
    if (!entry) continue;
    const resource = parseXml(await entry.async("text"));
    for (const font of elementsByLocalName(resource, "Font")) {
      const id = font.getAttribute("ID") || font.getAttribute("id");
      if (!id) continue;
      fonts.set(
        id,
        font.getAttribute("FontName") ||
          font.getAttribute("FamilyName") ||
          `OFD Font ${id}`,
      );
    }
  }

  return fonts;
}

function parsePageTextObjects(
  pageDocument: Document,
  fonts: Map<string, string>,
): OfdNativeRenderedText[] {
  const objects: OfdNativeRenderedText[] = [];

  for (const textObject of elementsByLocalName(pageDocument, "TextObject")) {
    const boundary = parseNumberList(textObject.getAttribute("Boundary") || "");
    if (boundary.length < 4) continue;
    const [boundaryX, boundaryY, boundaryWidth, boundaryHeight] = boundary;
    if (
      typeof boundaryX !== "number" ||
      typeof boundaryY !== "number" ||
      typeof boundaryWidth !== "number" ||
      typeof boundaryHeight !== "number"
    ) {
      continue;
    }
    const fontId = textObject.getAttribute("Font");
    const fontSize =
      parseFiniteNumber(textObject.getAttribute("Size")) ||
      boundaryHeight ||
      3.5;
    const fill = parseFillColor(textObject) ?? "#111827";
    const textCodes = elementsByLocalName(textObject, "TextCode");

    for (const textCode of textCodes) {
      const text = textCode.textContent ?? "";
      if (!text) continue;
      const x =
        boundaryX + (parseFiniteNumber(textCode.getAttribute("X")) ?? 0);
      const y =
        boundaryY + (parseFiniteNumber(textCode.getAttribute("Y")) ?? fontSize);
      objects.push({
        id:
          textObject.getAttribute("ID") ||
          textObject.getAttribute("id") ||
          `${objects.length + 1}`,
        text,
        x,
        y,
        width: boundaryWidth,
        height: boundaryHeight,
        fontId,
        fontFamily: (fontId && fonts.get(fontId)) || "sans-serif",
        fontSize,
        fill,
      });
    }
  }

  return objects;
}

function parseFillColor(textObject: Element): string | null {
  const color = elementsByLocalName(textObject, "FillColor")[0];
  const values = parseNumberList(color?.getAttribute("Value") || "");
  const [red, green, blue] = values;
  if (
    typeof red === "number" &&
    typeof green === "number" &&
    typeof blue === "number"
  ) {
    return rgb(red, green, blue);
  }
  return null;
}

function collectOfdEntries(zip: JSZip): OfdNativeEntry[] {
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({
      path: normalizeOfdPath(entry.name),
      kind: classifyOfdEntry(entry.name),
      directory: entry.dir,
      uncompressedSize: zipEntrySize(entry, "uncompressedSize"),
      compressedSize: zipEntrySize(entry, "compressedSize"),
      modifiedAt: entry.date instanceof Date ? entry.date.toISOString() : null,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function classifyOfdEntry(path: string): OfdNativeEntry["kind"] {
  const normalized = normalizeOfdPath(path);
  const lower = normalized.toLowerCase();
  if (lower === "ofd.xml" || lower.endsWith("/ofd.xml")) return "ofd-root";
  if (/(^|\/)document\.xml$/i.test(normalized)) return "document";
  if (/(^|\/)pages\/[^/]+\/content\.xml$/i.test(normalized)) return "page";
  if (
    /(^|\/)(publicres|documentres)\.xml$/i.test(normalized) ||
    /(^|\/)(res|resources)\//i.test(normalized)
  ) {
    return "resource";
  }
  if (/(^|\/)(signs|signatures|signature|seal)\//i.test(normalized)) {
    return "signature";
  }
  if (/(^|\/)(annots|annotations)\//i.test(normalized)) return "annotation";
  if (/(^|\/)(attachments|attachs)\//i.test(normalized)) return "attachment";
  if (lower.endsWith(".xml")) return "xml";
  return "data";
}

async function extractOfdTextSnippets(
  zip: JSZip,
  entries: OfdNativeEntry[],
): Promise<OfdNativeTextSnippet[]> {
  const xmlEntries = entries
    .filter(
      (entry) =>
        entry.path.toLowerCase().endsWith(".xml") &&
        [
          "ofd-root",
          "document",
          "page",
          "resource",
          "signature",
          "xml",
        ].includes(entry.kind) &&
        entry.uncompressedSize <= 2 * 1024 * 1024,
    )
    .slice(0, 80);
  const snippets: OfdNativeTextSnippet[] = [];

  for (const entry of xmlEntries) {
    const zipEntry = zip.file(entry.path);
    if (!zipEntry) continue;
    const xml = await zipEntry.async("text");
    const text = normalizeXmlText(xml);
    if (text) {
      snippets.push({
        path: entry.path,
        text: text.slice(0, 500),
      });
    }
  }
  return snippets.slice(0, 20);
}

function normalizeXmlText(xml: string): string {
  return xml
    .replace(/<\?xml[^>]*>/gi, " ")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function elementsByLocalName(
  root: Document | Element,
  localName: string,
): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (node): node is Element =>
      node.localName === localName ||
      node.nodeName.split(":").pop() === localName,
  );
}

function firstTextByLocalName(
  root: Document | Element,
  localName: string,
): string {
  return elementsByLocalName(root, localName)[0]?.textContent?.trim() ?? "";
}

function parseNumberList(value: string): number[] {
  return value
    .trim()
    .split(/[\s,]+/g)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function parseFiniteNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rgb(red: number, green: number, blue: number): string {
  const channels = [red, green, blue].map((value) =>
    Math.max(0, Math.min(255, Math.round(value))),
  );
  return `#${channels
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function dirnameOfdPath(path: string): string {
  const normalized = normalizeOfdPath(path);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "";
}

function resolveOfdPath(base: string, reference: string): string {
  const normalizedReference = normalizeOfdPath(reference.trim());
  if (!normalizedReference) return "";
  if (!base) return normalizedReference;
  const segments = `${base}/${normalizedReference}`.split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.join("/");
}

function zipEntrySize(
  entry: JSZip.JSZipObject,
  key: "compressedSize" | "uncompressedSize",
): number {
  const data = (
    entry as JSZip.JSZipObject & {
      _data?: Partial<Record<typeof key, unknown>>;
    }
  )._data;
  const value = data?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeOfdPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function publicOriginFromRequest(requestUrl: string): string {
  const configured = process.env.ARCHITOKEN_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(requestUrl);
  return url.origin;
}

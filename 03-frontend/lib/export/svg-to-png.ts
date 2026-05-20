/**
 * Pure DOM path: serialise a live SVG element → PNG blob → download.
 * Avoids html-to-image / dom-to-image. Works because the Studio floorplan
 * overlay SVG uses only inline attributes (no external stylesheets for
 * geometry). Text font families may fall back to platform defaults.
 */

export interface ExportPngOptions {
  readonly filename: string;
  readonly scale?: number;
  readonly background?: string;
}

export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  options: ExportPngOptions,
): Promise<void> {
  const scale = options.scale ?? 2;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  ensureSvgDimensions(clone, svg);
  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(svgUrl);
    const vbWidth = svg.viewBox.baseVal.width || svg.clientWidth || 800;
    const vbHeight = svg.viewBox.baseVal.height || svg.clientHeight || 600;
    const w = vbWidth * scale;
    const h = vbHeight * scale;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const pngBlob = await canvasToBlob(canvas);
    triggerDownload(pngBlob, options.filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function ensureSvgDimensions(clone: SVGSVGElement, original: SVGSVGElement): void {
  const vb = original.viewBox.baseVal;
  if (!clone.getAttribute("width")) clone.setAttribute("width", String(vb.width || original.clientWidth || 800));
  if (!clone.getAttribute("height")) clone.setAttribute("height", String(vb.height || original.clientHeight || 600));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("svg image load failed"));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas toBlob failed"));
    }, "image/png");
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

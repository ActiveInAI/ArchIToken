import type { Scene3D } from "@/lib/insome/scene";

/**
 * Minimal OBJ exporter for Phase 2.75.
 * Writes walls (each segment as a 6-face box) and floors (polygon fan) as
 * vertex+face plain text — no THREE.js OBJExporter dependency, no Three runtime.
 * Suitable for Blender / MeshLab / other 3D tools to import and inspect.
 */
export function sceneToObj(scene: Scene3D, name: string = "insome_floorplan"): string {
  const lines: string[] = [];
  lines.push(`# INSOME Phase 2.75 OBJ export — ${new Date().toISOString()}`);
  lines.push(`o ${name}`);
  let vIdx = 1;

  for (const w of scene.walls) {
    for (let si = 0; si < w.segments.length; si++) {
      const seg = w.segments[si]!;
      const ax = seg.a.x, az = seg.a.z;
      const bx = seg.b.x, bz = seg.b.z;
      const dx = bx - ax, dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-3) continue;
      const nx = -dz / len, nz = dx / len;
      const half = w.thickness / 2;
      const y0 = seg.yBottom;
      const y1 = seg.yTop;
      const p0 = [ax + nx * half, y0, az + nz * half];
      const p1 = [ax - nx * half, y0, az - nz * half];
      const p2 = [bx - nx * half, y0, bz - nz * half];
      const p3 = [bx + nx * half, y0, bz + nz * half];
      const p4 = [ax + nx * half, y1, az + nz * half];
      const p5 = [ax - nx * half, y1, az - nz * half];
      const p6 = [bx - nx * half, y1, bz - nz * half];
      const p7 = [bx + nx * half, y1, bz + nz * half];
      const vs = [p0, p1, p2, p3, p4, p5, p6, p7];
      for (const v of vs) lines.push(`v ${v[0]!.toFixed(4)} ${v[1]!.toFixed(4)} ${v[2]!.toFixed(4)}`);
      lines.push(`g wall_${w.id}_seg${si}`);
      const i0 = vIdx, i1 = vIdx + 1, i2 = vIdx + 2, i3 = vIdx + 3;
      const i4 = vIdx + 4, i5 = vIdx + 5, i6 = vIdx + 6, i7 = vIdx + 7;
      lines.push(`f ${i0} ${i1} ${i2} ${i3}`); // bottom
      lines.push(`f ${i4} ${i7} ${i6} ${i5}`); // top
      lines.push(`f ${i0} ${i3} ${i7} ${i4}`); // front
      lines.push(`f ${i1} ${i5} ${i6} ${i2}`); // back
      lines.push(`f ${i0} ${i4} ${i5} ${i1}`); // left
      lines.push(`f ${i3} ${i2} ${i6} ${i7}`); // right
      vIdx += 8;
    }
  }

  for (const r of scene.rooms) {
    if (r.polygon.length < 3) continue;
    const baseIdx = vIdx;
    for (const p of r.polygon) lines.push(`v ${p.x.toFixed(4)} 0 ${p.z.toFixed(4)}`);
    lines.push(`g floor_${r.id}`);
    const faceIndices = r.polygon.map((_, i) => baseIdx + i).join(" ");
    lines.push(`f ${faceIndices}`);
    vIdx += r.polygon.length;
  }

  return lines.join("\n");
}

export function downloadObjFromScene(scene: Scene3D, filename: string): void {
  const text = sceneToObj(scene);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import { CadWorkbench } from "../components/CadWorkbench";
import { PageHero } from "../components/PageHero";

export function CadPage() {
  return (
    <>
      <PageHero
        eyebrow="CAD Geometry"
        title="CAD"
        summary="Format conversion and entity extraction shell for open CAD workers and legally isolated proprietary boundaries."
        tags={["OCCT", "FreeCAD", "CadQuery", "DWG boundary"]}
      />
      <CadWorkbench />
    </>
  );
}

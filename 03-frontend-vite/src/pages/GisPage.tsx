import { GisRealityWorkbench } from "../components/GisRealityWorkbench";
import { PageHero } from "../components/PageHero";

export function GisPage() {
  return (
    <>
      <PageHero
        eyebrow="GIS / Reality"
        title="GIS Reality"
        summary="Spatial context for PostGIS layers, point clouds, 3D Tiles, panorama graph navigation, and WebXR boundaries."
        tags={["PostGIS", "PDAL", "3D Tiles", "Panorama", "WebXR"]}
      />
      <GisRealityWorkbench />
    </>
  );
}

import { AssetLibrary } from "../components/AssetLibrary";
import { AssetUploader } from "../components/AssetUploader";
import { ConversionJobPanel } from "../components/ConversionJobPanel";
import { PageHero } from "../components/PageHero";

export function AssetsPage() {
  return (
    <>
      <PageHero
        eyebrow="Universal Asset Registry"
        title="Assets"
        summary="Create, inspect, upload, bind, and convert AEC assets without bypassing RuntimeContext or tenant isolation."
        tags={["asset:read", "asset:write", "object binding", "conversion"]}
      />
      <div className="grid">
        <AssetUploader />
        <ConversionJobPanel />
      </div>
      <AssetLibrary />
    </>
  );
}

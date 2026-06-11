//! `GeometryRouter` — selects the geometry kernel/engine adapter for a CAD/BIM/mesh
//! source and returns an auditable routing decision.
//!
//! Registry over Enum: the router does not hard-code format branches. It layers on
//! the backend-native [`file_runtime_registry`], so adding a format there is enough
//! for the router to map it to a kernel capability profile, an IFC/openBIM binding
//! requirement, and a fallback kernel. This is a real boundary component — callers
//! ask the router which kernel to use instead of spreading extension checks.

use serde::Serialize;

use crate::file_runtime_registry::{self, FileProductionRoute, FileRuntimeRoute};

/// Geometry kernel / engine adapter the router can select.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GeometryKernel {
    /// buildingSMART IFC semantic kernel (`IfcOpenShell` worker).
    IfcOpenShell,
    /// Open CASCADE BREP kernel for STEP/IGES exchange.
    Occt,
    /// Mesh derivative kernel (Blender external process).
    Blender,
    /// `PanAEC` `OpenUSD` scene adapter.
    PanAecOpenUsd,
    /// `PanAEC` 3D Tiles streaming adapter.
    PanAec3dTiles,
    /// Native open DXF entity reader.
    DxfNative,
    /// License-gated vendor BIM adapter (RVT/RFA/SKP/3DM) that must export to IFC.
    LicensedBimAdapter,
}

/// Capability class the routed kernel produces.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GeometryCapability {
    /// Full BIM semantics (entities, property sets, spatial tree).
    BimSemantic,
    /// Boundary-representation solids.
    BrepSolid,
    /// Triangulated mesh only.
    Mesh,
    /// Scene exchange (`OpenUSD`).
    Scene,
    /// Streaming scene tiles (3D Tiles).
    SceneTiles,
    /// 2D drawing entities (layers, text, dimensions).
    DrawingEntities,
}

/// Auditable geometry routing decision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeometryRoutingDecision {
    /// Canonical format id from the file runtime registry.
    pub canonical_format: String,
    /// Runtime family (`openbim/cad/mesh/scene/scene_tiles/vendor_bim`).
    pub family: String,
    /// Selected geometry kernel.
    pub kernel: GeometryKernel,
    /// Capability class produced by the kernel.
    pub capability: GeometryCapability,
    /// Worker adapter id (from the file runtime route).
    pub adapter: String,
    /// Production readiness route inherited from the file runtime registry.
    pub production_route: FileProductionRoute,
    /// Worker must receive real source bytes before claiming work.
    pub source_required: bool,
    /// Non-IFC geometry must bind back to IFC/openBIM when BIM-derived.
    pub ifc_binding_when_bim_derived: bool,
    /// Fallback kernel if the primary kernel/adapter is unavailable.
    pub fallback_kernel: Option<GeometryKernel>,
    /// Human-readable routing rationale.
    pub reason: String,
}

/// `GeometryRouter` component (`Registry over Enum`, behavioral boundary).
#[derive(Debug, Clone, Copy, Default)]
pub struct GeometryRouter;

impl GeometryRouter {
    /// Create a new `GeometryRouter`.
    #[must_use]
    pub const fn new() -> Self {
        Self
    }

    /// Route a geometry source (extension or filename) to a kernel decision.
    /// Returns `None` for non-geometry sources (office/media/pdf).
    #[must_use]
    pub fn route(&self, file_name_or_ext: &str) -> Option<GeometryRoutingDecision> {
        route_geometry(file_name_or_ext)
    }

    /// True when the router can route the given source to a geometry kernel.
    #[must_use]
    pub fn supports(&self, file_name_or_ext: &str) -> bool {
        self.route(file_name_or_ext).is_some()
    }
}

/// Free-function form of [`GeometryRouter::route`].
#[must_use]
pub fn route_geometry(file_name_or_ext: &str) -> Option<GeometryRoutingDecision> {
    let route = file_runtime_registry::route_for_extension(file_name_or_ext)
        .or_else(|| file_runtime_registry::route_for_file_name(file_name_or_ext))?;
    let (kernel, capability) = kernel_and_capability(&route)?;
    let ifc_binding_when_bim_derived = route.family != "openbim";
    let reason = format!(
        "{} (.{} family={}) routes to {:?} producing {:?}; production_route={:?}.",
        route.canonical_format,
        route.extension,
        route.family,
        kernel,
        capability,
        route.production_route,
    );
    Some(GeometryRoutingDecision {
        canonical_format: route.canonical_format.to_owned(),
        family: route.family.to_owned(),
        kernel,
        capability,
        adapter: route.default_adapter.to_owned(),
        production_route: route.production_route,
        source_required: route.source_required,
        ifc_binding_when_bim_derived,
        fallback_kernel: fallback_for(kernel),
        reason,
    })
}

fn kernel_and_capability(route: &FileRuntimeRoute) -> Option<(GeometryKernel, GeometryCapability)> {
    let pair = match (route.family, route.canonical_format) {
        ("openbim", _) => (
            GeometryKernel::IfcOpenShell,
            GeometryCapability::BimSemantic,
        ),
        ("cad", "dxf") => (
            GeometryKernel::DxfNative,
            GeometryCapability::DrawingEntities,
        ),
        ("cad", _) => (GeometryKernel::Occt, GeometryCapability::BrepSolid),
        ("mesh", _) => (GeometryKernel::Blender, GeometryCapability::Mesh),
        ("scene", _) => (GeometryKernel::PanAecOpenUsd, GeometryCapability::Scene),
        ("scene_tiles", _) => (
            GeometryKernel::PanAec3dTiles,
            GeometryCapability::SceneTiles,
        ),
        ("vendor_bim", _) => (
            GeometryKernel::LicensedBimAdapter,
            GeometryCapability::BimSemantic,
        ),
        // office/document/audio/video/image families are not geometry sources.
        _ => return None,
    };
    Some(pair)
}

const fn fallback_for(kernel: GeometryKernel) -> Option<GeometryKernel> {
    match kernel {
        // BREP and scene kernels can fall back to an inspectable mesh derivative.
        GeometryKernel::Occt | GeometryKernel::PanAecOpenUsd => Some(GeometryKernel::Blender),
        // Vendor BIM must bridge to the open IFC kernel.
        GeometryKernel::LicensedBimAdapter => Some(GeometryKernel::IfcOpenShell),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{GeometryCapability, GeometryKernel, GeometryRouter};
    use crate::file_runtime_registry::FileProductionRoute;

    #[test]
    fn routes_open_bim_and_cad_and_mesh_and_scene() {
        let router = GeometryRouter::new();
        assert_eq!(
            router.route("model.ifc").unwrap().kernel,
            GeometryKernel::IfcOpenShell
        );
        assert_eq!(
            router.route("part.step").unwrap().capability,
            GeometryCapability::BrepSolid
        );
        assert_eq!(
            router.route("drawing.dxf").unwrap().kernel,
            GeometryKernel::DxfNative
        );
        assert_eq!(
            router.route("widget.stl").unwrap().capability,
            GeometryCapability::Mesh
        );
        assert_eq!(
            router.route("scene.usd").unwrap().kernel,
            GeometryKernel::PanAecOpenUsd
        );
        assert_eq!(
            router.route("payload.b3dm").unwrap().capability,
            GeometryCapability::SceneTiles
        );
    }

    #[test]
    fn vendor_bim_falls_back_to_ifc_and_requires_binding() {
        let decision = GeometryRouter::new().route("tower.rvt").unwrap();
        assert_eq!(decision.kernel, GeometryKernel::LicensedBimAdapter);
        assert_eq!(decision.fallback_kernel, Some(GeometryKernel::IfcOpenShell));
        assert_eq!(
            decision.production_route,
            FileProductionRoute::LicensedAdapterRequired
        );
        assert!(decision.ifc_binding_when_bim_derived);
    }

    #[test]
    fn ifc_is_authoritative_and_needs_no_extra_binding() {
        let decision = GeometryRouter::new().route("model.ifc").unwrap();
        assert!(!decision.ifc_binding_when_bim_derived);
        assert!(decision.source_required);
    }

    #[test]
    fn non_geometry_sources_do_not_route() {
        let router = GeometryRouter::new();
        assert!(router.route("report.docx").is_none());
        assert!(router.route("photo.png").is_none());
        assert!(router.route("contract.pdf").is_none());
        assert!(!router.supports("notes.xlsx"));
    }

    #[test]
    fn brep_and_scene_fall_back_to_mesh() {
        let router = GeometryRouter::new();
        assert_eq!(
            router.route("part.iges").unwrap().fallback_kernel,
            Some(GeometryKernel::Blender)
        );
        assert_eq!(
            router.route("scene.usdz").unwrap().fallback_kernel,
            Some(GeometryKernel::Blender)
        );
    }
}

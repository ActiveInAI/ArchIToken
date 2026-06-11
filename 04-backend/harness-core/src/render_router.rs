//! `RenderRouter` — selects the rendering backend for a viewable artifact and
//! returns an auditable decision that enforces the Constitution's WebGPU-first rule.
//!
//! Registry over Enum: render formats and their backend/fallback chains live in a
//! data table, so adding a format does not require new branches in viewer code.
//! WebGL is only ever an explicitly recorded fallback, never the primary path.

use serde::Serialize;

/// Rendering backend the router can select.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RenderBackend {
    /// WebGPU compute/render — primary browser path.
    WebGpu,
    /// Three.js running on its WebGPU backend (ecosystem layer over WebGPU).
    ThreeWebGpu,
    /// Three.js WebGL backend — audited fallback only.
    ThreeWebGl,
    /// `PanAEC` 3D Tiles streaming renderer.
    Tiles3d,
    /// `OpenUSD` Hydra-style scene renderer.
    OpenUsdHydra,
    /// Server-side offscreen render (thumbnails / headless).
    ServerOffscreen,
}

/// The surface the render targets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RenderTarget {
    /// Interactive engineering viewport.
    InteractiveViewport,
    /// Static thumbnail / preview image.
    Thumbnail,
    /// Streamed large-scene / digital-twin view.
    Stream,
}

/// Auditable render routing decision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRoutingDecision {
    /// Canonical render format key.
    pub format: String,
    /// Requested target surface.
    pub target: RenderTarget,
    /// Primary backend (always WebGPU-first for interactive targets).
    pub primary_backend: RenderBackend,
    /// Ordered fallback chain; WebGL only appears here, never as primary.
    pub fallback_chain: Vec<RenderBackend>,
    /// Whether the primary path satisfies the WebGPU-first rule.
    pub webgpu_first: bool,
    /// Human-readable routing rationale.
    pub reason: String,
}

/// One render format capability row.
#[derive(Debug, Clone, Copy)]
struct RenderFormatRoute {
    format: &'static str,
    interactive: RenderBackend,
    stream: RenderBackend,
    thumbnail: RenderBackend,
    fallback: &'static [RenderBackend],
}

const RENDER_ROUTES: &[RenderFormatRoute] = &[
    RenderFormatRoute {
        format: "ifc",
        interactive: RenderBackend::WebGpu,
        stream: RenderBackend::Tiles3d,
        thumbnail: RenderBackend::ServerOffscreen,
        fallback: &[RenderBackend::ThreeWebGpu, RenderBackend::ThreeWebGl],
    },
    RenderFormatRoute {
        format: "gltf",
        interactive: RenderBackend::ThreeWebGpu,
        stream: RenderBackend::Tiles3d,
        thumbnail: RenderBackend::ServerOffscreen,
        fallback: &[RenderBackend::ThreeWebGl],
    },
    RenderFormatRoute {
        format: "glb",
        interactive: RenderBackend::ThreeWebGpu,
        stream: RenderBackend::Tiles3d,
        thumbnail: RenderBackend::ServerOffscreen,
        fallback: &[RenderBackend::ThreeWebGl],
    },
    RenderFormatRoute {
        format: "usd",
        interactive: RenderBackend::OpenUsdHydra,
        stream: RenderBackend::Tiles3d,
        thumbnail: RenderBackend::ServerOffscreen,
        fallback: &[RenderBackend::WebGpu, RenderBackend::ThreeWebGl],
    },
    RenderFormatRoute {
        format: "3dtiles",
        interactive: RenderBackend::Tiles3d,
        stream: RenderBackend::Tiles3d,
        thumbnail: RenderBackend::ServerOffscreen,
        fallback: &[RenderBackend::WebGpu, RenderBackend::ThreeWebGl],
    },
    RenderFormatRoute {
        format: "pointcloud",
        interactive: RenderBackend::WebGpu,
        stream: RenderBackend::Tiles3d,
        thumbnail: RenderBackend::ServerOffscreen,
        fallback: &[RenderBackend::ThreeWebGl],
    },
];

/// `RenderRouter` component.
#[derive(Debug, Clone, Copy, Default)]
pub struct RenderRouter;

impl RenderRouter {
    /// Create a new `RenderRouter`.
    #[must_use]
    pub const fn new() -> Self {
        Self
    }

    /// Route a render request to a backend decision. Returns `None` for unknown formats.
    #[must_use]
    pub fn route(&self, format: &str, target: RenderTarget) -> Option<RenderRoutingDecision> {
        route_render(format, target)
    }
}

/// Free-function form of [`RenderRouter::route`].
#[must_use]
pub fn route_render(format: &str, target: RenderTarget) -> Option<RenderRoutingDecision> {
    let key = format.trim().trim_start_matches('.').to_ascii_lowercase();
    let route = RENDER_ROUTES.iter().find(|r| r.format == key)?;
    let primary_backend = match target {
        RenderTarget::InteractiveViewport => route.interactive,
        RenderTarget::Stream => route.stream,
        RenderTarget::Thumbnail => route.thumbnail,
    };
    // Thumbnails are server-side by design; interactive/stream must be WebGPU-first.
    let webgpu_first =
        matches!(target, RenderTarget::Thumbnail) || is_webgpu_first(primary_backend);
    let reason = format!(
        "format={key} target={target:?} -> {primary_backend:?}; webgpu_first={webgpu_first}; \
         WebGL only as audited fallback."
    );
    Some(RenderRoutingDecision {
        format: key,
        target,
        primary_backend,
        fallback_chain: route.fallback.to_vec(),
        webgpu_first,
        reason,
    })
}

const fn is_webgpu_first(backend: RenderBackend) -> bool {
    matches!(
        backend,
        RenderBackend::WebGpu
            | RenderBackend::ThreeWebGpu
            | RenderBackend::Tiles3d
            | RenderBackend::OpenUsdHydra
            | RenderBackend::ServerOffscreen
    )
}

#[cfg(test)]
mod tests {
    use super::{RenderBackend, RenderRouter, RenderTarget};

    #[test]
    fn ifc_interactive_is_webgpu_first() {
        let decision = RenderRouter::new()
            .route("ifc", RenderTarget::InteractiveViewport)
            .unwrap();
        assert_eq!(decision.primary_backend, RenderBackend::WebGpu);
        assert!(decision.webgpu_first);
    }

    #[test]
    fn webgl_is_only_ever_a_fallback_never_primary() {
        let router = RenderRouter::new();
        for format in ["ifc", "gltf", "glb", "usd", "3dtiles", "pointcloud"] {
            for target in [
                RenderTarget::InteractiveViewport,
                RenderTarget::Stream,
                RenderTarget::Thumbnail,
            ] {
                let decision = router.route(format, target).unwrap();
                assert_ne!(
                    decision.primary_backend,
                    RenderBackend::ThreeWebGl,
                    "WebGL must never be the primary backend for {format}/{target:?}"
                );
            }
        }
    }

    #[test]
    fn interactive_and_stream_paths_are_webgpu_first() {
        let router = RenderRouter::new();
        for format in ["ifc", "gltf", "glb", "usd", "3dtiles", "pointcloud"] {
            for target in [RenderTarget::InteractiveViewport, RenderTarget::Stream] {
                assert!(
                    router.route(format, target).unwrap().webgpu_first,
                    "{format}/{target:?} must satisfy WebGPU-first"
                );
            }
        }
    }

    #[test]
    fn unknown_format_does_not_route() {
        assert!(
            RenderRouter::new()
                .route("docx", RenderTarget::Thumbnail)
                .is_none()
        );
    }
}

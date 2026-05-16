//! # `ArchIToken` Harness Core
//!
//! L3 · The Rust foundation of `ArchIToken`.
//!
//! Implements the backend Harness engine foundation:
//! - **Geometry Engine**: CAD geometry plus BIM geometric domains, topology, clash, and derivatives
//! - **Data Engine**: BIM semantics, model quantity takeoff, objects, metadata, graph, timeseries, and audit
//! - **Display Engine**: auditable viewer commands, layers, scene manifests, and inspection data
//! - **Render Engine**: thumbnails, previews, documents, frames, waveforms, and render payloads
//! - **AI Engine**: model routing, tool use, generation, extraction, evaluation, and approval
//!
//! BIM is not treated as CAD. It is a cross-engine engineering information
//! model covering spatial structure, element identity, properties,
//! relationships, model quantity takeoff, 4D schedule, 5D cost, documents,
//! coordination, operations, geospatial context, and change history.
//!
//! Constitutional compliance (see `02-architecture/CONSTITUTION.md`):
//! - Article 1 `Agent = Model + Harness` — all model calls MUST go through `InferenceRouter`
//! - Article 6 Layer dependencies flow strictly from L0 to L7
//! - Article 7 All 6 inference engines implement `ChatCompletion` trait
//! - Article 8 SLA enforcement via `RollbackGuard`
//! - Article 15 `RollbackGuard` auto-recovers within 30 seconds
//!
//! License: Apache-2.0 OR MIT

#![deny(unsafe_code)]
#![warn(missing_docs, clippy::pedantic, clippy::nursery)]
#![allow(clippy::module_name_repetitions)]

pub mod asset_registry;
pub mod cde;
pub mod config;
pub mod db;
pub mod durable_store;
pub mod error;
pub mod file_runtime_registry;
pub mod generation_engine;
pub mod harness_engines;
pub mod inference;
pub mod knowledge_registry;
pub mod mcp_tool_registry;
pub mod module_audit;
pub mod module_files;
pub mod module_generation;
pub mod module_lifecycle;
pub mod module_pagination;
pub mod module_registry;
pub mod object_store_s3;
pub mod observability;
pub mod openbim;
pub mod permissions;
pub mod phase8_runtime;
pub mod postgres_runtime_store;
pub mod rag;
pub mod rollback_guard;
pub mod runtime_capabilities;
pub mod runtime_context;
pub mod runtime_execution;
pub mod skill_registry;
pub mod sla;
pub mod storage_router;
pub mod tools;
pub mod viewer_adapter;

pub use error::{HarnessError, Result};
pub use inference::{ChatCompletion, InferenceRouter, Message, ModelId};
pub use rollback_guard::RollbackGuard;

/// Crate-wide version constant (kept in sync with `Cargo.toml`).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Harness constitutional invariants — checked at runtime startup.
pub mod invariants {
    use super::{HarnessError, Result, harness_engines};

    /// Verify license compliance at startup (Constitution §3).
    ///
    /// # Errors
    /// Returns `HarnessError::LicenseViolation` if any runtime-embedded
    /// dependency is detected with AGPL/GPL/SSPL license.
    pub fn verify_licenses() -> Result<()> {
        // Runtime verification; the authoritative check is CI-side `cargo-deny`.
        // This is a belt-and-braces sanity check.
        const FORBIDDEN_CRATES: &[&str] = &["libsodium-sys-stable"];
        for crate_name in FORBIDDEN_CRATES {
            if has_crate_linked(crate_name) {
                return Err(HarnessError::LicenseViolation((*crate_name).to_owned()));
            }
        }
        Ok(())
    }

    /// Verify the five backend Harness engine categories and required
    /// CAD/BIM/PDF/Office/Image/Voice/Video coverage and the required BIM
    /// information domains are present.
    ///
    /// # Errors
    /// Returns `HarnessError::Internal` if the engine registry misses a
    /// required category, file/media family, or governance stage.
    pub fn verify_engine_contract() -> Result<()> {
        harness_engines::verify_harness_engine_contract()
    }

    #[allow(clippy::must_use_candidate, clippy::unused_self)]
    const fn has_crate_linked(_name: &str) -> bool {
        // Placeholder — a real implementation would introspect compiled metadata.
        false
    }
}

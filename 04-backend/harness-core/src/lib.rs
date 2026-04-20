//! # InsomeOS Harness Core
//!
//! L3 · The Rust foundation of InsomeOS.
//!
//! Implements the 5 Harness modules (per 智灵姐 · 2026-04-14 · "Harness 时代"):
//! - **Tools**: AEC file format parsers (via `insomeos-file-parsers`)
//! - **Knowledge**: RAG retrieval from Supabase pgvector
//! - **Observation**: OpenTelemetry tracing + metrics + RollbackGuard
//! - **Action Interfaces**: Unified REST (axum) + gRPC (tonic) + MCP
//! - **Permissions**: RBAC + sandboxed tool execution + audit logs
//!
//! Constitutional compliance (see `02-architecture/CONSTITUTION.md`):
//! - §1 `Agent = Model + Harness` — all model calls MUST go through `InferenceRouter`
//! - §6 Layer dependencies flow strictly from L0 to L7
//! - §7 All 6 inference engines implement `ChatCompletion` trait
//! - §8 SLA enforcement via `RollbackGuard`
//! - §15 RollbackGuard auto-reverts within 30 seconds
//!
//! License: Apache-2.0 OR MIT

#![deny(unsafe_code)]
#![warn(missing_docs, clippy::pedantic, clippy::nursery)]
#![allow(clippy::module_name_repetitions)]

pub mod config;
pub mod error;
pub mod inference;
pub mod observability;
pub mod permissions;
pub mod rag;
pub mod rollback_guard;
pub mod sla;
pub mod tools;

pub use error::{HarnessError, Result};
pub use inference::{ChatCompletion, InferenceRouter, Message, ModelId};
pub use rollback_guard::RollbackGuard;

/// Crate-wide version constant (kept in sync with `Cargo.toml`).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Harness constitutional invariants — checked at runtime startup.
pub mod invariants {
    use super::{HarnessError, Result};

    /// Verify license compliance at startup (Constitution §3).
    ///
    /// # Errors
    /// Returns `HarnessError::LicenseViolation` if any runtime-embedded
    /// dependency is detected with AGPL/GPL/SSPL license.
    pub fn verify_licenses() -> Result<()> {
        // Runtime verification; the authoritative check is CI-side `cargo-deny`.
        // This is a belt-and-braces sanity check.
        const FORBIDDEN_CRATES: &[&str] = &[
            "libsodium-sys-stable", // placeholder example; keep list empty at build
        ];
        for crate_name in FORBIDDEN_CRATES {
            if has_crate_linked(crate_name) {
                return Err(HarnessError::LicenseViolation(
                    (*crate_name).to_owned(),
                ));
            }
        }
        Ok(())
    }

    #[allow(clippy::must_use_candidate, clippy::unused_self)]
    fn has_crate_linked(_name: &str) -> bool {
        // Placeholder — a real implementation would introspect compiled metadata.
        false
    }
}

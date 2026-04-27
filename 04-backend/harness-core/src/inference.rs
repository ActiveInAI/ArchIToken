//! Inference routing across 6 engines.
//!
//! The `InferenceRouter` is the single entry point for all model calls.
//! Per Constitution §1, direct engine SDK calls bypassing this router are
//! rejected at CI.
//!
//! Supported engines (all OpenAI-compatible):
//! - `Engine::VLlm` — vllm-project/vllm v0.19.1
//! - `Engine::SgLang` — sgl-project/sglang v0.5.10.post1
//! - `Engine::TensorRtLlm` — NVIDIA/TensorRT-LLM v1.2.0
//! - `Engine::LmDeploy` — InternLM/lmdeploy v0.12.3
//! - `Engine::Ollama` — ollama/ollama v0.21.0
//! - `Engine::LlamaCpp` — ggml-org/llama.cpp b8840

use async_trait::async_trait;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::Stream;
use tracing::{info, instrument, warn};

use crate::error::{HarnessError, Result};

/// A stable identifier for a model variant on an inference engine.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ModelId(pub String);

impl ModelId {
    /// Create a new model id. Empty strings are rejected.
    ///
    /// # Errors
    /// Returns an error if `name` is empty or contains whitespace.
    pub fn new(name: impl Into<String>) -> Result<Self> {
        let name = name.into();
        if name.is_empty() || name.contains(char::is_whitespace) {
            return Err(HarnessError::InvalidModelId(name));
        }
        Ok(Self(name))
    }
}

/// Supported inference engines (Constitution §7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Engine {
    /// vLLM — default, broad model support.
    VLlm,
    /// `SGLang` — best for complex multi-turn agent flows.
    SgLang,
    /// TensorRT-LLM — peak DGX Spark performance.
    TensorRtLlm,
    /// `LMDeploy` — optimized for Chinese models (Qwen3.5, GLM4.7).
    LmDeploy,
    /// Ollama — local dev iteration, not prod path.
    Ollama,
    /// llama.cpp — CPU/edge fallback.
    LlamaCpp,
}

/// A chat message.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "role", rename_all = "lowercase")]
pub enum Message {
    /// System-level instruction.
    System {
        /// Message body.
        content: String,
    },
    /// User-authored message.
    User {
        /// Message body.
        content: String,
    },
    /// Assistant-generated reply.
    Assistant {
        /// Message body.
        content: String,
    },
    /// Tool invocation result.
    Tool {
        /// Tool output content.
        content: String,
        /// Tool call identifier this result answers.
        tool_call_id: String,
    },
}

/// A chat completion request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    /// Target model.
    pub model: ModelId,
    /// Conversation history.
    pub messages: Vec<Message>,
    /// Sampling temperature (0.0 = deterministic).
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    /// Max output tokens.
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    /// Stream responses via SSE when true.
    #[serde(default)]
    pub stream: bool,
}

const fn default_temperature() -> f32 {
    0.2
}

const fn default_max_tokens() -> u32 {
    4096
}

/// A chat completion response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// Content of the assistant's reply.
    pub content: String,
    /// Prompt tokens used.
    pub prompt_tokens: u32,
    /// Completion tokens produced.
    pub completion_tokens: u32,
    /// Engine that served the request.
    pub engine: Engine,
    /// Model id that served the request.
    pub model: ModelId,
    /// Wall-clock latency.
    pub latency: Duration,
}

/// Core trait implemented by every inference engine adapter.
///
/// All 6 supported engines MUST provide an OpenAI-compatible implementation
/// (Constitution §7). Contract tests live in `tests/compat_suite.rs`.
#[async_trait]
pub trait ChatCompletion: Send + Sync {
    /// Return which engine this adapter wraps.
    fn engine(&self) -> Engine;

    /// Synchronous (non-streaming) completion.
    async fn complete(&self, req: ChatRequest) -> Result<ChatResponse>;

    /// Streaming completion (SSE-compatible).
    async fn stream(
        &self,
        req: ChatRequest,
    ) -> Result<Box<dyn Stream<Item = Result<String>> + Send + Unpin>>;

    /// Lightweight health check.
    async fn health(&self) -> Result<()>;
}

/// The one and only inference entry point.
///
/// Holds one `ChatCompletion` per registered engine and routes requests
/// according to the configured model registry and failover policy.
pub struct InferenceRouter {
    adapters: Arc<DashMap<Engine, Arc<dyn ChatCompletion>>>,
    /// Default engine when none specified for a model.
    default_engine: Engine,
    /// Rollback guard enforcing SLA (§8) and <30s recovery (§15).
    guard: Arc<crate::rollback_guard::RollbackGuard>,
}

impl InferenceRouter {
    /// Create a new router with the given default engine and guard.
    #[must_use]
    pub fn new(default_engine: Engine, guard: Arc<crate::rollback_guard::RollbackGuard>) -> Self {
        Self {
            adapters: Arc::new(DashMap::new()),
            default_engine,
            guard,
        }
    }

    /// Register an adapter for the given engine.
    pub fn register(&self, adapter: Arc<dyn ChatCompletion>) {
        let engine = adapter.engine();
        info!(?engine, "Registered inference adapter");
        self.adapters.insert(engine, adapter);
    }

    /// Dispatch a chat request, honoring rollback and SLA.
    ///
    /// # Errors
    /// Returns `HarnessError::NoAdapter` if no engine is registered.
    #[instrument(skip(self, req), fields(model = %req.model.0))]
    pub async fn complete(&self, req: ChatRequest) -> Result<ChatResponse> {
        let engine = self.guard.preferred_engine().unwrap_or(self.default_engine);

        let adapter = self
            .adapters
            .get(&engine)
            .map(|entry| entry.clone())
            .ok_or(HarnessError::NoAdapter(engine))?;

        let start = std::time::Instant::now();
        let result = adapter.complete(req).await;
        let elapsed = start.elapsed();

        match result {
            Ok(resp) => {
                self.guard.record_success(engine, elapsed).await;
                Ok(resp)
            }
            Err(err) => {
                warn!(?engine, ?err, "Inference failed, recording for rollback");
                self.guard.record_failure(engine, elapsed).await;
                Err(err)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_id_rejects_empty() {
        assert!(ModelId::new("").is_err());
    }

    #[test]
    fn model_id_rejects_whitespace() {
        assert!(ModelId::new("claude 4.7").is_err());
        assert!(ModelId::new("claude-4.7").is_ok());
    }

    #[test]
    fn default_values() {
        assert!((default_temperature() - 0.2).abs() < f32::EPSILON);
        assert_eq!(default_max_tokens(), 4096);
    }
}

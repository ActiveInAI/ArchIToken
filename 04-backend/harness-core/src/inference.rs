//! Inference routing across registered engines.
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
//! - `Engine::LmStudio` — local LM Studio OpenAI-compatible runtime
//! - `Engine::HuggingFace` — local Hugging Face TGI/endpoint adapter
//! - `Engine::LlamaCpp` — ggml-org/llama.cpp b8840

use async_trait::async_trait;
use dashmap::DashMap;
use futures::stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::Stream;
use tracing::{info, instrument, warn};

use crate::config::EngineConfig;
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
    /// `LMDeploy` — optimized for locally deployed Chinese model families.
    LmDeploy,
    /// Ollama — local dev iteration, not prod path.
    Ollama,
    /// LM Studio — local OpenAI-compatible desktop/server runtime.
    LmStudio,
    /// Hugging Face — local TGI or configured Inference Endpoint adapter.
    HuggingFace,
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
/// All supported engines MUST provide an OpenAI-compatible implementation
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

/// OpenAI-compatible HTTP adapter for runtime engines.
///
/// Hugging Face TGI, Hugging Face Inference Endpoints, vLLM, LM Studio and
/// llama.cpp all expose this contract when configured with `/v1`.
#[derive(Debug, Clone)]
pub struct OpenAiCompatibleChatAdapter {
    engine: Engine,
    base_url: String,
    api_key_env: Option<String>,
    client: reqwest::Client,
}

impl OpenAiCompatibleChatAdapter {
    /// Build an adapter from one configured inference engine endpoint.
    ///
    /// # Errors
    /// Returns an error if `base_url` is empty or the HTTP client cannot be built.
    pub fn from_config(config: &EngineConfig) -> Result<Self> {
        Self::new(
            config.engine,
            &config.base_url,
            config.api_key_env.clone(),
            Duration::from_secs(config.timeout_secs),
        )
    }

    /// Create an OpenAI-compatible HTTP chat adapter.
    ///
    /// # Errors
    /// Returns an error if `base_url` is empty or the HTTP client cannot be built.
    pub fn new(
        engine: Engine,
        base_url: impl Into<String>,
        api_key_env: Option<String>,
        timeout: Duration,
    ) -> Result<Self> {
        let base_url = base_url.into();
        if base_url.trim().is_empty() {
            return Err(HarnessError::InvalidInput(
                "inference engine base_url is required".to_owned(),
            ));
        }
        let client = reqwest::Client::builder().timeout(timeout).build()?;
        Ok(Self {
            engine,
            base_url,
            api_key_env: api_key_env.filter(|name| !name.trim().is_empty()),
            client,
        })
    }

    fn bearer_token(&self) -> Option<String> {
        let env_name = self.api_key_env.as_ref()?;
        std::env::var(env_name)
            .ok()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
    }

    fn with_auth(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(token) = self.bearer_token() {
            request.bearer_auth(token)
        } else {
            request
        }
    }
}

#[async_trait]
impl ChatCompletion for OpenAiCompatibleChatAdapter {
    fn engine(&self) -> Engine {
        self.engine
    }

    async fn complete(&self, req: ChatRequest) -> Result<ChatResponse> {
        let requested_model = req.model.clone();
        let endpoint = chat_completions_url(&self.base_url)?;
        let body = serde_json::json!({
            "model": requested_model.0,
            "messages": req.messages,
            "temperature": req.temperature,
            "max_tokens": req.max_tokens,
            "stream": false,
        });
        let started = std::time::Instant::now();
        let response = self
            .with_auth(self.client.post(endpoint).json(&body))
            .send()
            .await?;
        let status = response.status();
        let response_text = response.text().await?;
        if !status.is_success() {
            return Err(HarnessError::Upstream(format!(
                "{:?} returned HTTP {}: {}",
                self.engine,
                status.as_u16(),
                trim_upstream_message(&response_text)
            )));
        }

        let payload: Value = serde_json::from_str(&response_text)?;
        if let Some(error) = payload.get("error") {
            return Err(HarnessError::Upstream(format!(
                "{:?} returned error: {}",
                self.engine,
                trim_upstream_message(&error.to_string())
            )));
        }

        let content = extract_openai_chat_content(&payload).ok_or_else(|| {
            HarnessError::Upstream(format!(
                "{:?} returned no assistant content from chat completion",
                self.engine
            ))
        })?;
        let model = payload
            .get("model")
            .and_then(Value::as_str)
            .and_then(|value| ModelId::new(value).ok())
            .unwrap_or(requested_model);
        let usage = payload.get("usage");

        Ok(ChatResponse {
            content,
            prompt_tokens: usage_token(usage, "prompt_tokens"),
            completion_tokens: usage_token(usage, "completion_tokens"),
            engine: self.engine,
            model,
            latency: started.elapsed(),
        })
    }

    async fn stream(
        &self,
        _req: ChatRequest,
    ) -> Result<Box<dyn Stream<Item = Result<String>> + Send + Unpin>> {
        Ok(Box::new(stream::iter([Err(HarnessError::InvalidInput(
            "streaming chat completions are not enabled on the OpenAI-compatible HTTP adapter yet"
                .to_owned(),
        ))])))
    }

    async fn health(&self) -> Result<()> {
        let endpoint = models_url(&self.base_url)?;
        let response = self.with_auth(self.client.get(endpoint)).send().await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(HarnessError::Upstream(format!(
                "{:?} health check returned HTTP {}",
                self.engine,
                response.status().as_u16()
            )))
        }
    }
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

fn chat_completions_url(base_url: &str) -> Result<reqwest::Url> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let url = if trimmed.ends_with("/chat/completions") {
        trimmed.to_owned()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    };
    reqwest::Url::parse(&url)
        .map_err(|err| HarnessError::InvalidInput(format!("invalid chat completion URL: {err}")))
}

fn models_url(base_url: &str) -> Result<reqwest::Url> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let base = trimmed
        .strip_suffix("/chat/completions")
        .unwrap_or(trimmed)
        .trim_end_matches('/');
    let url = if base.ends_with("/v1") {
        format!("{base}/models")
    } else {
        format!("{base}/v1/models")
    };
    reqwest::Url::parse(&url)
        .map_err(|err| HarnessError::InvalidInput(format!("invalid models URL: {err}")))
}

fn extract_openai_chat_content(payload: &Value) -> Option<String> {
    let choices = payload.get("choices")?.as_array()?;
    let first = choices.first()?;
    let message = first.get("message");
    let value = message
        .and_then(|message| message.get("content"))
        .or_else(|| first.get("text"))
        .or_else(|| payload.get("output_text"))
        .or_else(|| payload.get("content"))?;
    let text = content_value_to_text(value);
    if text.is_empty() { None } else { Some(text) }
}

fn content_value_to_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.trim().to_owned(),
        Value::Array(items) => items
            .iter()
            .filter_map(|item| {
                item.as_str().map_or_else(
                    || {
                        item.get("text")
                            .or_else(|| item.get("content"))
                            .and_then(Value::as_str)
                            .map(|text| text.trim().to_owned())
                    },
                    |text| Some(text.trim().to_owned()),
                )
            })
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn usage_token(usage: Option<&Value>, field: &str) -> u32 {
    let value = usage
        .and_then(|value| value.get(field))
        .and_then(Value::as_u64)
        .unwrap_or_default()
        .min(u64::from(u32::MAX));
    u32::try_from(value).unwrap_or(u32::MAX)
}

fn trim_upstream_message(value: &str) -> String {
    const LIMIT: usize = 700;
    let compact = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.len() > LIMIT {
        compact.chars().take(LIMIT).collect()
    } else {
        compact
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{method, path},
    };

    #[test]
    fn model_id_rejects_empty() {
        assert!(ModelId::new("").is_err());
    }

    #[test]
    fn model_id_rejects_whitespace() {
        assert!(ModelId::new("architoken generator").is_err());
        assert!(ModelId::new("architoken-generator").is_ok());
    }

    #[test]
    fn default_values() {
        assert!((default_temperature() - 0.2).abs() < f32::EPSILON);
        assert_eq!(default_max_tokens(), 4096);
    }

    #[tokio::test]
    async fn openai_compatible_adapter_completes_chat() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "model": "architoken-generator",
                "choices": [
                    {"message": {"role": "assistant", "content": "pong"}}
                ],
                "usage": {"prompt_tokens": 3, "completion_tokens": 5}
            })))
            .mount(&server)
            .await;

        let adapter = OpenAiCompatibleChatAdapter::new(
            Engine::HuggingFace,
            format!("{}/v1", server.uri()),
            None,
            Duration::from_secs(5),
        )
        .expect("adapter should build");
        let response = adapter
            .complete(ChatRequest {
                model: ModelId::new("architoken-generator").expect("model id"),
                messages: vec![Message::User {
                    content: "ping".to_owned(),
                }],
                temperature: 0.2,
                max_tokens: 16,
                stream: false,
            })
            .await
            .expect("completion should succeed");

        assert_eq!(response.content, "pong");
        assert_eq!(response.engine, Engine::HuggingFace);
        assert_eq!(response.prompt_tokens, 3);
        assert_eq!(response.completion_tokens, 5);
    }

    #[tokio::test]
    async fn openai_compatible_adapter_health_checks_models_endpoint() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1/models"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "object": "list",
                "data": [{"id": "architoken-generator"}]
            })))
            .mount(&server)
            .await;

        let adapter = OpenAiCompatibleChatAdapter::new(
            Engine::HuggingFace,
            format!("{}/v1", server.uri()),
            None,
            Duration::from_secs(5),
        )
        .expect("adapter should build");

        adapter.health().await.expect("health should pass");
    }
}

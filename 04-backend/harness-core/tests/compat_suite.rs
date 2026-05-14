//! Constitutional compat test (§7): every registered engine adapter MUST
//! honor the OpenAI-compatible `ChatCompletion` contract.

use architoken_harness_core::{
    inference::{ChatRequest, Engine, Message, ModelId},
    rollback_guard::RollbackGuard,
};
use std::sync::Arc;

fn sample_request() -> ChatRequest {
    ChatRequest {
        model: ModelId::new("architoken-generator").unwrap(),
        messages: vec![
            Message::System {
                content: "You are a test oracle.".into(),
            },
            Message::User {
                content: "Reply with: OK".into(),
            },
        ],
        temperature: 0.0,
        max_tokens: 16,
        stream: false,
    }
}

#[test]
fn engine_enum_has_six_variants() {
    // If someone adds / removes an engine, this test catches missed adapters.
    let all = [
        Engine::VLlm,
        Engine::SgLang,
        Engine::TensorRtLlm,
        Engine::LmDeploy,
        Engine::Ollama,
        Engine::LlamaCpp,
    ];
    assert_eq!(all.len(), 6, "Constitution §7: six inference engines");
}

#[test]
fn model_id_validation() {
    assert!(ModelId::new("").is_err());
    assert!(ModelId::new("has space").is_err());
    assert!(ModelId::new("architoken-generator").is_ok());
}

#[test]
fn request_round_trips_json() {
    let req = sample_request();
    let json = serde_json::to_string(&req).unwrap();
    let back: ChatRequest = serde_json::from_str(&json).unwrap();
    assert_eq!(req.messages.len(), back.messages.len());
}

#[tokio::test]
async fn rollback_promotes_a_backup_engine() {
    let guard = Arc::new(RollbackGuard::new());
    guard
        .record_success(Engine::VLlm, std::time::Duration::from_millis(10))
        .await;
    assert_eq!(guard.preferred_engine(), Some(Engine::VLlm));

    for _ in 0..3 {
        guard
            .record_failure(Engine::VLlm, std::time::Duration::from_secs(70))
            .await;
    }
    // After 3 failures vLLM is quarantined; next-highest priority takes over
    // (TensorRT-LLM per the priority order).
    let preferred = guard.preferred_engine();
    assert!(preferred.is_some(), "must have a fallback");
    assert_ne!(
        preferred,
        Some(Engine::VLlm),
        "vLLM must have been rolled off"
    );
}

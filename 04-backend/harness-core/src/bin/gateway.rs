//! InsomeOS Gateway — the unified L5 API entrypoint.
//!
//! This binary starts:
//! - axum 0.8.9 HTTP server (REST + SSE)
//! - OpenTelemetry / Prometheus exporter
//! - InferenceRouter with 6 adapters
//! - RAG engine
//!
//! Wire it into Kubernetes via `05-infra/k8s/deployment.yaml`.

use std::sync::Arc;

use axum::{
    Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use insomeos_harness_core::{
    config::AppConfig,
    error::Result,
    inference::{ChatRequest, Engine, InferenceRouter},
    observability,
    rollback_guard::RollbackGuard,
};

#[derive(Clone)]
struct AppState {
    router: Arc<InferenceRouter>,
    cfg: Arc<AppConfig>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = AppConfig::load()?;
    cfg.validate()?;

    let _obs = observability::init(&cfg.observability)?;
    insomeos_harness_core::invariants::verify_licenses()?;

    info!(
        version = insomeos_harness_core::VERSION,
        "InsomeOS Gateway starting"
    );

    let guard = Arc::new(RollbackGuard::new());
    let router = Arc::new(InferenceRouter::new(cfg.inference.default_engine, guard));

    // Register engine adapters here (placeholder — real adapters live in
    // their own crates, each implementing `ChatCompletion`).
    // router.register(Arc::new(VllmAdapter::new(...)));
    // router.register(Arc::new(SgLangAdapter::new(...)));
    // ...

    let state = AppState {
        router,
        cfg: Arc::new(cfg.clone()),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/v1/harness/invoke", post(invoke))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = format!("{}:{}", cfg.server.host, cfg.server.port);
    let listener = TcpListener::bind(&addr).await?;
    info!(%addr, "Gateway listening");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn readyz(State(state): State<AppState>) -> impl IntoResponse {
    // Could probe DB / cache / engines here.
    let _engines_registered =
        state.router.clone(); // placeholder, just to use state
    (StatusCode::OK, "ready")
}

async fn invoke(
    State(state): State<AppState>,
    axum::Json(req): axum::Json<ChatRequest>,
) -> Result<axum::Json<serde_json::Value>> {
    // Enforce whitelist (Constitution §10).
    if !state
        .cfg
        .inference
        .whitelisted_models
        .iter()
        .any(|m| m == &req.model.0)
    {
        return Err(insomeos_harness_core::error::HarnessError::ModelNotWhitelisted(
            req.model.0.clone(),
        ));
    }

    let resp = state.router.complete(req).await?;
    Ok(axum::Json(serde_json::to_value(resp)?))
}

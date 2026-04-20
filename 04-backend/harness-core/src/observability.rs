//! OpenTelemetry + Prometheus observability.
//!
//! Initializes structured JSON logging, OTLP tracing exporter, and a
//! Prometheus metrics endpoint.

use opentelemetry::global;
use opentelemetry_otlp::WithExportConfig;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, fmt};

use crate::config::ObservabilityConfig;
use crate::error::{HarnessError, Result};

/// Initialize logging + tracing + metrics.
///
/// Call once at startup. Returns a `Guard` which must be kept alive
/// for the process lifetime.
///
/// # Errors
/// Returns an error if the OTLP exporter cannot be initialized.
pub fn init(cfg: &ObservabilityConfig) -> Result<Guard> {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&cfg.log_level));

    // OTLP tracer
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(&cfg.otlp_endpoint),
        )
        .with_trace_config(
            opentelemetry_sdk::trace::config().with_resource(
                opentelemetry_sdk::Resource::new(vec![
                    opentelemetry::KeyValue::new(
                        "service.name",
                        cfg.service_name.clone(),
                    ),
                    opentelemetry::KeyValue::new(
                        "service.version",
                        crate::VERSION,
                    ),
                ]),
            ),
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)
        .map_err(|e| HarnessError::Internal(format!("otlp init: {e}")))?;

    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().json().with_current_span(true))
        .with(otel_layer)
        .init();

    // Prometheus
    let prometheus_handle =
        metrics_exporter_prometheus::PrometheusBuilder::new()
            .with_http_listener(
                ([0, 0, 0, 0], cfg.prometheus_port),
            )
            .install()
            .map_err(|e| HarnessError::Internal(format!("prometheus: {e}")))?;

    tracing::info!(
        service = %cfg.service_name,
        otlp = %cfg.otlp_endpoint,
        prometheus_port = cfg.prometheus_port,
        "Observability initialized"
    );

    Ok(Guard {
        _prometheus: prometheus_handle,
    })
}

/// RAII guard that flushes telemetry on drop.
pub struct Guard {
    _prometheus: (),
}

impl Drop for Guard {
    fn drop(&mut self) {
        global::shutdown_tracer_provider();
    }
}

/// Record a business metric with Constitution §8 SLA awareness.
#[macro_export]
macro_rules! record_latency {
    ($name:expr, $category:expr, $elapsed:expr) => {{
        metrics::histogram!($name, "category" => format!("{:?}", $category))
            .record($elapsed.as_secs_f64());
    }};
}

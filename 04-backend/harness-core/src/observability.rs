//! OpenTelemetry + Prometheus observability.
//!
//! Initializes structured JSON logging, OTLP tracing exporter, and a
//! Prometheus metrics endpoint.

use opentelemetry::KeyValue;
use opentelemetry::global;
use opentelemetry::trace::TracerProvider as _;
use opentelemetry_otlp::{SpanExporter, WithExportConfig};
use opentelemetry_sdk::Resource;
use opentelemetry_sdk::trace::SdkTracerProvider;
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
/// Returns an error if the OTLP exporter or Prometheus listener cannot be
/// initialized.
pub fn init(cfg: &ObservabilityConfig) -> Result<Guard> {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&cfg.log_level));

    let exporter = SpanExporter::builder()
        .with_tonic()
        .with_endpoint(&cfg.otlp_endpoint)
        .build()
        .map_err(|e| HarnessError::Internal(format!("otlp exporter: {e}")))?;

    let resource = Resource::builder()
        .with_attribute(KeyValue::new("service.name", cfg.service_name.clone()))
        .with_attribute(KeyValue::new("service.version", crate::VERSION))
        .build();

    let provider = SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(resource)
        .build();

    let tracer = provider.tracer("insomeos-harness-core");
    global::set_tracer_provider(provider.clone());

    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().json().with_current_span(true))
        .with(otel_layer)
        .init();

    metrics_exporter_prometheus::PrometheusBuilder::new()
        .with_http_listener(([0, 0, 0, 0], cfg.prometheus_port))
        .install()
        .map_err(|e| HarnessError::Internal(format!("prometheus: {e}")))?;

    tracing::info!(
        service = %cfg.service_name,
        otlp = %cfg.otlp_endpoint,
        prometheus_port = cfg.prometheus_port,
        "Observability initialized"
    );

    Ok(Guard { provider })
}

/// RAII guard that flushes telemetry on drop.
pub struct Guard {
    provider: SdkTracerProvider,
}

impl Drop for Guard {
    fn drop(&mut self) {
        // Best-effort graceful flush of pending spans before process exit.
        let _ = self.provider.shutdown();
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

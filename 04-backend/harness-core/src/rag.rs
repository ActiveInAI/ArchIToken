//! RAG — Retrieval Augmented Generation over AEC knowledge.
//!
//! The RAG engine routes vector search through a `VectorStore`-shaped adapter.
//! The current trunk adapter is `PostgreSQL` with `pgvector`; external stores
//! such as Qdrant can be wired later without changing RAG callers.

use reqwest::header::{HeaderMap, HeaderValue};
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tracing::instrument;

use crate::error::{HarnessError, Result};
use crate::permissions::TenantId;

const RAG_EMBEDDING_DIM: usize = 1536;
const DEFAULT_QDRANT_RAG_COLLECTION: &str = "architoken_rag";

/// RAG vector-store provider selected by configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RagVectorStoreProvider {
    /// `PostgreSQL` `pgvector` trunk.
    PgVector,
    /// External Qdrant adapter.
    Qdrant,
}

/// Configuration for selecting a RAG vector-store adapter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RagVectorStoreConfig {
    /// Selected vector-store provider.
    pub provider: RagVectorStoreProvider,
    /// Qdrant HTTP endpoint when `provider = qdrant`.
    pub qdrant_endpoint: Option<String>,
    /// Qdrant collection name.
    pub qdrant_collection: String,
    /// Optional Qdrant API key.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qdrant_api_key: Option<String>,
}

impl Default for RagVectorStoreConfig {
    fn default() -> Self {
        Self {
            provider: RagVectorStoreProvider::PgVector,
            qdrant_endpoint: None,
            qdrant_collection: DEFAULT_QDRANT_RAG_COLLECTION.to_owned(),
            qdrant_api_key: None,
        }
    }
}

impl RagVectorStoreConfig {
    /// Build RAG vector-store config from process environment.
    ///
    /// # Errors
    /// Returns validation errors for unsupported providers or unsafe Qdrant values.
    pub fn from_env() -> Result<Self> {
        let qdrant_endpoint = first_non_empty_env(&["ARCHITOKEN_VECTOR__URL", "QDRANT_URL"]);
        let provider = match first_non_empty_env(&["ARCHITOKEN_VECTOR__PROVIDER"]) {
            Some(value) => parse_rag_vector_provider(&value)?,
            None if qdrant_endpoint.is_some() => RagVectorStoreProvider::Qdrant,
            None => RagVectorStoreProvider::PgVector,
        };
        let qdrant_collection =
            first_non_empty_env(&["ARCHITOKEN_VECTOR__COLLECTION", "QDRANT_COLLECTION"])
                .unwrap_or_else(|| DEFAULT_QDRANT_RAG_COLLECTION.to_owned());
        let qdrant_collection = qdrant_collection.trim().to_owned();
        validate_qdrant_collection(&qdrant_collection)?;
        let qdrant_endpoint = qdrant_endpoint
            .as_deref()
            .map(normalize_qdrant_endpoint)
            .transpose()?;
        Ok(Self {
            provider,
            qdrant_endpoint,
            qdrant_collection,
            qdrant_api_key: first_non_empty_env(&["ARCHITOKEN_VECTOR__API_KEY", "QDRANT_API_KEY"]),
        })
    }
}

/// A retrieved text chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    /// Chunk identifier.
    pub id: uuid::Uuid,
    /// Source corpus or document name.
    pub source: String,
    /// Section heading for display and citation.
    pub heading: String,
    /// Retrieved text content.
    pub content: String,
    /// Similarity score returned by vector search.
    pub score: f32,
    /// Additional source metadata.
    pub metadata: serde_json::Value,
}

/// A query against the knowledge store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagQuery {
    /// Tenant that owns the query context.
    pub tenant: TenantId,
    /// Natural-language retrieval query.
    pub text: String,
    /// Maximum number of chunks to return.
    pub top_k: usize,
    /// Optional corpus filter: `["gb", "ibc", "eurocode", "project"]`
    pub corpora: Vec<String>,
}

/// A vector-search request produced after query embedding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSearchRequest {
    /// Tenant that owns the query context.
    pub tenant: TenantId,
    /// Query embedding.
    pub embedding: Vec<f32>,
    /// Maximum number of chunks to return.
    pub top_k: usize,
    /// Corpus filter.
    pub corpora: Vec<String>,
}

/// Input for indexing one RAG chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagChunkUpsert {
    /// Optional stable chunk id. When omitted a new id is generated.
    pub id: Option<uuid::Uuid>,
    /// Tenant that owns this chunk.
    pub tenant: TenantId,
    /// Corpus key such as `gb`, `ibc`, `eurocode`, or `project`.
    pub corpus: String,
    /// Source corpus or document name.
    pub source: String,
    /// Section heading for display and citation.
    pub heading: String,
    /// Retrieved text content.
    pub content: String,
    /// Embedding vector.
    pub embedding: Vec<f32>,
    /// Additional source metadata.
    pub metadata: serde_json::Value,
}

/// The retrieval pipeline.
pub struct RagEngine {
    vector_store: Box<dyn RagVectorStore>,
    embedding_fn: Box<dyn EmbeddingFn>,
}

/// Vector search and indexing contract used by RAG.
#[async_trait::async_trait]
pub trait RagVectorStore: Send + Sync {
    /// Retrieve relevant chunks for an embedded query.
    ///
    /// # Errors
    /// Returns storage or validation errors.
    async fn search(&self, request: &VectorSearchRequest) -> Result<Vec<Chunk>>;

    /// Upsert one chunk into the vector store.
    ///
    /// # Errors
    /// Returns storage or validation errors.
    async fn upsert_chunk(&self, request: &RagChunkUpsert) -> Result<uuid::Uuid>;
}

/// `PostgreSQL` / `pgvector` RAG vector-store adapter.
#[derive(Debug, Clone)]
pub struct PgVectorRagStore {
    db: DatabaseConnection,
}

impl PgVectorRagStore {
    /// Construct a `pgvector` RAG store from an existing database connection.
    #[must_use]
    pub const fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

/// Qdrant-backed RAG vector-store adapter.
#[derive(Debug, Clone)]
pub struct QdrantRagStore {
    endpoint: String,
    collection: String,
    api_key: Option<String>,
    http_client: reqwest::Client,
}

impl QdrantRagStore {
    /// Construct a Qdrant adapter from an HTTP endpoint and collection name.
    ///
    /// # Errors
    /// Returns validation errors for unsupported endpoints or unsafe collection names.
    pub fn new(
        endpoint: impl AsRef<str>,
        collection: impl Into<String>,
        api_key: Option<String>,
    ) -> Result<Self> {
        Self::with_client(endpoint, collection, api_key, reqwest::Client::new())
    }

    /// Construct a Qdrant adapter with an explicit HTTP client.
    ///
    /// # Errors
    /// Returns validation errors for unsupported endpoints or unsafe collection names.
    pub fn with_client(
        endpoint: impl AsRef<str>,
        collection: impl Into<String>,
        api_key: Option<String>,
        http_client: reqwest::Client,
    ) -> Result<Self> {
        let endpoint = normalize_qdrant_endpoint(endpoint.as_ref())?;
        let collection = collection.into().trim().to_owned();
        validate_qdrant_collection(&collection)?;
        Ok(Self {
            endpoint,
            collection,
            api_key,
            http_client,
        })
    }

    /// Create the configured collection with the current RAG embedding shape.
    ///
    /// # Errors
    /// Returns HTTP or upstream errors from Qdrant.
    pub async fn create_collection(&self) -> Result<()> {
        let body = qdrant_create_collection_body();
        self.send_qdrant_json(
            self.http_client
                .put(self.qdrant_url(&format!("collections/{}", self.collection))),
            &body,
            "qdrant create collection",
        )
        .await?;
        Ok(())
    }

    fn qdrant_url(&self, path: &str) -> String {
        format!("{}/{}", self.endpoint, path.trim_start_matches('/'))
    }

    fn with_auth(&self, mut headers: HeaderMap) -> Result<HeaderMap> {
        if let Some(api_key) = self.api_key.as_deref().filter(|value| !value.is_empty()) {
            let value = HeaderValue::from_str(api_key)
                .map_err(|_| HarnessError::InvalidInput("invalid qdrant api key".to_owned()))?;
            headers.insert("api-key", value);
        }
        Ok(headers)
    }

    async fn send_qdrant_json<T: serde::Serialize + Sync + ?Sized>(
        &self,
        builder: reqwest::RequestBuilder,
        body: &T,
        operation: &str,
    ) -> Result<Value> {
        let headers = self.with_auth(HeaderMap::new())?;
        let response = builder.headers(headers).json(body).send().await?;
        let status = response.status();
        let body = response.text().await?;
        if !status.is_success() {
            return Err(HarnessError::Upstream(format!(
                "{operation} failed with HTTP {status}: {body}"
            )));
        }
        Ok(serde_json::from_str(&body).unwrap_or_else(|_| json!({})))
    }
}

/// Trait for generating embeddings (keeps the engine provider-agnostic).
#[async_trait::async_trait]
pub trait EmbeddingFn: Send + Sync {
    /// Generate an embedding vector for the supplied text.
    ///
    /// # Errors
    /// Returns an error if the embedding provider rejects or cannot process the text.
    async fn embed(&self, text: &str) -> Result<Vec<f32>>;
}

impl RagEngine {
    /// Construct a new `RagEngine` with the current Postgres `pgvector` trunk.
    #[must_use]
    pub fn new(db: DatabaseConnection, embedding_fn: Box<dyn EmbeddingFn>) -> Self {
        Self::with_vector_store(Box::new(PgVectorRagStore::new(db)), embedding_fn)
    }

    /// Construct a new `RagEngine` using environment-selected vector storage.
    ///
    /// # Errors
    /// Returns validation errors when configured external storage is incomplete.
    pub fn from_env(db: DatabaseConnection, embedding_fn: Box<dyn EmbeddingFn>) -> Result<Self> {
        Self::from_vector_store_config(db, embedding_fn, &RagVectorStoreConfig::from_env()?)
    }

    /// Construct a new `RagEngine` using an explicit vector-store config.
    ///
    /// # Errors
    /// Returns validation errors when configured external storage is incomplete.
    pub fn from_vector_store_config(
        db: DatabaseConnection,
        embedding_fn: Box<dyn EmbeddingFn>,
        config: &RagVectorStoreConfig,
    ) -> Result<Self> {
        let vector_store: Box<dyn RagVectorStore> = match config.provider {
            RagVectorStoreProvider::PgVector => Box::new(PgVectorRagStore::new(db)),
            RagVectorStoreProvider::Qdrant => {
                let endpoint = config.qdrant_endpoint.as_deref().ok_or_else(|| {
                    HarnessError::InvalidInput(
                        "ARCHITOKEN_VECTOR__URL or QDRANT_URL is required for qdrant RAG vector store"
                            .to_owned(),
                    )
                })?;
                Box::new(QdrantRagStore::new(
                    endpoint,
                    config.qdrant_collection.clone(),
                    config.qdrant_api_key.clone(),
                )?)
            }
        };
        Ok(Self::with_vector_store(vector_store, embedding_fn))
    }

    /// Construct a new `RagEngine` with an explicit vector-store adapter.
    #[must_use]
    pub fn with_vector_store(
        vector_store: Box<dyn RagVectorStore>,
        embedding_fn: Box<dyn EmbeddingFn>,
    ) -> Self {
        Self {
            vector_store,
            embedding_fn,
        }
    }

    /// Retrieve the top-k most relevant chunks for the query.
    ///
    /// # Errors
    /// Returns DB or embedding errors.
    #[instrument(skip(self), fields(top_k = q.top_k))]
    pub async fn retrieve(&self, q: &RagQuery) -> Result<Vec<Chunk>> {
        if q.text.trim().is_empty() {
            return Err(HarnessError::InvalidInput("empty query".into()));
        }
        if q.top_k == 0 || q.top_k > 50 {
            return Err(HarnessError::InvalidInput("top_k must be 1..=50".into()));
        }
        let embedding = self.embedding_fn.embed(&q.text).await?;
        validate_embedding(&embedding)?;

        let corpora = if q.corpora.is_empty() {
            vec!["gb".to_string(), "project".to_string()]
        } else {
            q.corpora.clone()
        };

        self.vector_store
            .search(&VectorSearchRequest {
                tenant: q.tenant,
                embedding,
                top_k: q.top_k,
                corpora,
            })
            .await
    }
}

#[async_trait::async_trait]
impl RagVectorStore for PgVectorRagStore {
    async fn search(&self, request: &VectorSearchRequest) -> Result<Vec<Chunk>> {
        if request.top_k == 0 || request.top_k > 50 {
            return Err(HarnessError::InvalidInput("top_k must be 1..=50".into()));
        }
        validate_embedding(&request.embedding)?;
        let limit = i64::try_from(request.top_k)
            .map_err(|_| HarnessError::InvalidInput("top_k exceeds i64 limit".into()))?;
        let embedding_str = format_vector(&request.embedding);
        let corpora = if request.corpora.is_empty() {
            vec!["gb".to_string(), "project".to_string()]
        } else {
            request.corpora.clone()
        };
        let sql = r"
            SELECT id, source, heading, content,
                   (1 - (embedding <=> $1::vector))::real AS score,
                   metadata
            FROM   rag_chunks
            WHERE  tenant_id = $2
              AND  corpus = ANY($3)
            ORDER  BY embedding <=> $1::vector
            LIMIT  $4
        ";

        let rows = self
            .db
            .query_all_raw(Statement::from_sql_and_values(
                DbBackend::Postgres,
                sql,
                vec![
                    embedding_str.into(),
                    request.tenant.0.into(),
                    corpora.into(),
                    limit.into(),
                ],
            ))
            .await?;

        let mut out = Vec::with_capacity(rows.len());
        for row in rows {
            out.push(Chunk {
                id: row.try_get("", "id").unwrap_or_default(),
                source: row.try_get("", "source").unwrap_or_default(),
                heading: row.try_get("", "heading").unwrap_or_default(),
                content: row.try_get("", "content").unwrap_or_default(),
                score: row.try_get::<f32>("", "score").unwrap_or_default(),
                metadata: row
                    .try_get("", "metadata")
                    .unwrap_or_else(|_| serde_json::json!({})),
            });
        }
        Ok(out)
    }

    async fn upsert_chunk(&self, request: &RagChunkUpsert) -> Result<uuid::Uuid> {
        validate_embedding(&request.embedding)?;
        validate_required("corpus", &request.corpus)?;
        validate_required("source", &request.source)?;
        validate_required("heading", &request.heading)?;
        validate_required("content", &request.content)?;
        let id = request.id.unwrap_or_else(uuid::Uuid::new_v4);
        let embedding_str = format_vector(&request.embedding);
        let sql = r"
            INSERT INTO rag_chunks (
                id, tenant_id, corpus, source, heading, content, embedding, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
            ON CONFLICT (id) DO UPDATE SET
                corpus = EXCLUDED.corpus,
                source = EXCLUDED.source,
                heading = EXCLUDED.heading,
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata
            RETURNING id
        ";
        let rows = self
            .db
            .query_all_raw(Statement::from_sql_and_values(
                DbBackend::Postgres,
                sql,
                vec![
                    id.into(),
                    request.tenant.0.into(),
                    request.corpus.clone().into(),
                    request.source.clone().into(),
                    request.heading.clone().into(),
                    request.content.clone().into(),
                    embedding_str.into(),
                    request.metadata.clone().into(),
                ],
            ))
            .await?;
        rows.first()
            .and_then(|row| row.try_get("", "id").ok())
            .ok_or_else(|| HarnessError::Internal("rag chunk upsert returned no id".to_owned()))
    }
}

#[async_trait::async_trait]
impl RagVectorStore for QdrantRagStore {
    async fn search(&self, request: &VectorSearchRequest) -> Result<Vec<Chunk>> {
        if request.top_k == 0 || request.top_k > 50 {
            return Err(HarnessError::InvalidInput("top_k must be 1..=50".into()));
        }
        validate_embedding(&request.embedding)?;
        let corpora = if request.corpora.is_empty() {
            vec!["gb".to_string(), "project".to_string()]
        } else {
            request.corpora.clone()
        };
        let body = qdrant_query_body(request.tenant, &request.embedding, request.top_k, &corpora)?;
        let response = self
            .send_qdrant_json(
                self.http_client.post(
                    self.qdrant_url(&format!("collections/{}/points/query", self.collection)),
                ),
                &body,
                "qdrant query points",
            )
            .await?;
        qdrant_chunks_from_response(&response)
    }

    async fn upsert_chunk(&self, request: &RagChunkUpsert) -> Result<uuid::Uuid> {
        validate_embedding(&request.embedding)?;
        validate_required("corpus", &request.corpus)?;
        validate_required("source", &request.source)?;
        validate_required("heading", &request.heading)?;
        validate_required("content", &request.content)?;
        let id = request.id.unwrap_or_else(uuid::Uuid::new_v4);
        let body = qdrant_upsert_body(id, request);
        self.send_qdrant_json(
            self.http_client
                .put(self.qdrant_url(&format!("collections/{}/points", self.collection)))
                .query(&[("wait", "true")]),
            &body,
            "qdrant upsert points",
        )
        .await?;
        Ok(id)
    }
}

fn format_vector(v: &[f32]) -> String {
    let mut s = String::from("[");
    for (i, x) in v.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        s.push_str(&x.to_string());
    }
    s.push(']');
    s
}

fn validate_embedding(v: &[f32]) -> Result<()> {
    if v.len() != RAG_EMBEDDING_DIM {
        return Err(HarnessError::InvalidInput(format!(
            "embedding must have {RAG_EMBEDDING_DIM} dimensions"
        )));
    }
    Ok(())
}

fn validate_required(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(HarnessError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

fn first_non_empty_env(names: &[&str]) -> Option<String> {
    names.iter().find_map(|name| {
        std::env::var(name)
            .ok()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
    })
}

fn parse_rag_vector_provider(value: &str) -> Result<RagVectorStoreProvider> {
    match value.trim().to_ascii_lowercase().as_str() {
        "pgvector" | "postgres_pgvector" | "postgres" => Ok(RagVectorStoreProvider::PgVector),
        "qdrant" => Ok(RagVectorStoreProvider::Qdrant),
        other => Err(HarnessError::InvalidInput(format!(
            "unsupported RAG vector provider: {other}"
        ))),
    }
}

fn normalize_qdrant_endpoint(endpoint: &str) -> Result<String> {
    let trimmed = endpoint.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(HarnessError::InvalidInput(
            "qdrant endpoint is required".to_owned(),
        ));
    }
    let url = reqwest::Url::parse(trimmed)
        .map_err(|err| HarnessError::InvalidInput(format!("invalid qdrant endpoint: {err}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(HarnessError::InvalidInput(
            "qdrant endpoint must use http or https".to_owned(),
        ));
    }
    Ok(trimmed.to_owned())
}

fn validate_qdrant_collection(collection: &str) -> Result<()> {
    let collection = collection.trim();
    if collection.is_empty() {
        return Err(HarnessError::InvalidInput(
            "qdrant collection is required".to_owned(),
        ));
    }
    if !collection
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.'))
    {
        return Err(HarnessError::InvalidInput(
            "qdrant collection may only contain ASCII letters, digits, dot, dash or underscore"
                .to_owned(),
        ));
    }
    Ok(())
}

fn qdrant_create_collection_body() -> Value {
    json!({
        "vectors": {
            "size": RAG_EMBEDDING_DIM,
            "distance": "Cosine"
        }
    })
}

fn qdrant_query_body(
    tenant: TenantId,
    embedding: &[f32],
    top_k: usize,
    corpora: &[String],
) -> Result<Value> {
    validate_embedding(embedding)?;
    if top_k == 0 || top_k > 50 {
        return Err(HarnessError::InvalidInput("top_k must be 1..=50".into()));
    }
    Ok(json!({
        "query": embedding,
        "filter": {
            "must": [
                {
                    "key": "tenant_id",
                    "match": { "value": tenant.0.to_string() }
                },
                {
                    "key": "corpus",
                    "match": { "any": corpora }
                }
            ]
        },
        "limit": top_k,
        "with_payload": true
    }))
}

fn qdrant_upsert_body(id: uuid::Uuid, request: &RagChunkUpsert) -> Value {
    json!({
        "points": [
            {
                "id": id.to_string(),
                "vector": request.embedding,
                "payload": {
                    "tenant_id": request.tenant.0.to_string(),
                    "corpus": request.corpus,
                    "source": request.source,
                    "heading": request.heading,
                    "content": request.content,
                    "metadata": request.metadata
                }
            }
        ]
    })
}

fn qdrant_chunks_from_response(response: &Value) -> Result<Vec<Chunk>> {
    let points = response
        .get("result")
        .and_then(|result| {
            result
                .get("points")
                .and_then(Value::as_array)
                .or_else(|| result.as_array())
        })
        .ok_or_else(|| {
            HarnessError::Upstream("qdrant response missing result points".to_owned())
        })?;
    points.iter().map(qdrant_chunk_from_point).collect()
}

fn qdrant_chunk_from_point(point: &Value) -> Result<Chunk> {
    let payload = point.get("payload").cloned().unwrap_or_else(|| json!({}));
    let id = point
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| HarnessError::Upstream("qdrant point missing uuid id".to_owned()))
        .and_then(|value| {
            uuid::Uuid::parse_str(value)
                .map_err(|err| HarnessError::Upstream(format!("invalid qdrant point id: {err}")))
        })?;
    Ok(Chunk {
        id,
        source: payload_string(&payload, "source"),
        heading: payload_string(&payload, "heading"),
        content: payload_string(&payload, "content"),
        score: point
            .get("score")
            .and_then(Value::as_f64)
            .map(qdrant_score_to_f32)
            .unwrap_or_default(),
        metadata: payload
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| json!({})),
    })
}

#[allow(clippy::cast_possible_truncation)]
const fn qdrant_score_to_f32(value: f64) -> f32 {
    value as f32
}

fn payload_string(payload: &Value, field: &str) -> String {
    payload
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    use uuid::Uuid;
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{header, method, path, query_param},
    };

    use super::{
        Chunk, EmbeddingFn, QdrantRagStore, RagChunkUpsert, RagEngine, RagQuery, RagVectorStore,
        RagVectorStoreConfig, RagVectorStoreProvider, VectorSearchRequest, format_vector,
        normalize_qdrant_endpoint, parse_rag_vector_provider, qdrant_chunk_from_point,
        qdrant_create_collection_body, qdrant_query_body, qdrant_upsert_body, validate_embedding,
        validate_qdrant_collection,
    };
    use crate::{Result, permissions::TenantId};

    struct FixedEmbedding;

    #[async_trait::async_trait]
    impl EmbeddingFn for FixedEmbedding {
        async fn embed(&self, _text: &str) -> Result<Vec<f32>> {
            Ok(vec![0.1; super::RAG_EMBEDDING_DIM])
        }
    }

    struct RecordingVectorStore {
        calls: Arc<AtomicUsize>,
    }

    #[async_trait::async_trait]
    impl RagVectorStore for RecordingVectorStore {
        async fn search(&self, request: &VectorSearchRequest) -> Result<Vec<Chunk>> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            assert_eq!(request.top_k, 2);
            assert_eq!(request.corpora, vec!["project".to_owned()]);
            Ok(vec![Chunk {
                id: Uuid::nil(),
                source: "project-spec".to_owned(),
                heading: "heading".to_owned(),
                content: "content".to_owned(),
                score: 0.9,
                metadata: serde_json::json!({ "adapter": "test" }),
            }])
        }

        async fn upsert_chunk(&self, _request: &RagChunkUpsert) -> Result<Uuid> {
            Ok(Uuid::nil())
        }
    }

    #[tokio::test]
    async fn rag_engine_uses_vector_store_adapter() {
        let calls = Arc::new(AtomicUsize::new(0));
        let engine = RagEngine::with_vector_store(
            Box::new(RecordingVectorStore {
                calls: Arc::clone(&calls),
            }),
            Box::new(FixedEmbedding),
        );
        let chunks = engine
            .retrieve(&RagQuery {
                tenant: TenantId(Uuid::new_v4()),
                text: "施工规范".to_owned(),
                top_k: 2,
                corpora: vec!["project".to_owned()],
            })
            .await
            .expect("retrieve should use vector adapter");
        assert_eq!(chunks.len(), 1);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn qdrant_store_upserts_chunk_over_http() {
        let server = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path("/collections/architoken_rag/points"))
            .and(query_param("wait", "true"))
            .and(header("api-key", "secret"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "ok",
                "result": { "status": "acknowledged" }
            })))
            .mount(&server)
            .await;

        let id = Uuid::new_v4();
        let tenant = TenantId(Uuid::new_v4());
        let store = QdrantRagStore::new(server.uri(), "architoken_rag", Some("secret".to_owned()))
            .expect("qdrant store should build");
        let returned = store
            .upsert_chunk(&RagChunkUpsert {
                id: Some(id),
                tenant,
                corpus: "project".to_owned(),
                source: "spec".to_owned(),
                heading: "Fire rating".to_owned(),
                content: "Use approved material evidence.".to_owned(),
                embedding: vec![0.1; super::RAG_EMBEDDING_DIM],
                metadata: serde_json::json!({ "standard": "project" }),
            })
            .await
            .expect("upsert should complete");
        assert_eq!(returned, id);
    }

    #[tokio::test]
    async fn qdrant_store_searches_points_over_http() {
        let server = MockServer::start().await;
        let id = Uuid::new_v4();
        Mock::given(method("POST"))
            .and(path("/collections/architoken_rag/points/query"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "ok",
                "result": {
                    "points": [
                        {
                            "id": id.to_string(),
                            "score": 0.91,
                            "payload": {
                                "source": "gb",
                                "heading": "Clause",
                                "content": "Evidence text",
                                "metadata": { "page": 12 }
                            }
                        }
                    ]
                }
            })))
            .mount(&server)
            .await;

        let tenant = TenantId(Uuid::new_v4());
        let store = QdrantRagStore::new(server.uri(), "architoken_rag", None)
            .expect("qdrant store should build");
        let chunks = store
            .search(&VectorSearchRequest {
                tenant,
                embedding: vec![0.1; super::RAG_EMBEDDING_DIM],
                top_k: 1,
                corpora: vec!["gb".to_owned()],
            })
            .await
            .expect("search should complete");
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].id, id);
        assert_eq!(chunks[0].source, "gb");
        assert_eq!(chunks[0].metadata["page"], 12);
    }

    #[test]
    fn embedding_validation_matches_pgvector_dimension() {
        assert!(validate_embedding(&vec![0.0; super::RAG_EMBEDDING_DIM]).is_ok());
        assert!(validate_embedding(&[0.0, 1.0]).is_err());
    }

    #[test]
    fn vector_format_is_pgvector_compatible() {
        assert_eq!(format_vector(&[0.1, 0.2, 0.3]), "[0.1,0.2,0.3]");
    }

    #[test]
    fn qdrant_config_validation_rejects_unsafe_values() {
        assert_eq!(
            normalize_qdrant_endpoint("http://localhost:6333/").expect("endpoint should normalize"),
            "http://localhost:6333"
        );
        assert!(normalize_qdrant_endpoint("file:///tmp/qdrant").is_err());
        assert!(validate_qdrant_collection("architoken_rag.v1").is_ok());
        assert!(validate_qdrant_collection("../rag").is_err());
        assert_eq!(
            parse_rag_vector_provider("postgres_pgvector").expect("provider should parse"),
            RagVectorStoreProvider::PgVector
        );
        assert_eq!(
            parse_rag_vector_provider("qdrant").expect("provider should parse"),
            RagVectorStoreProvider::Qdrant
        );
        assert!(parse_rag_vector_provider("direct-vendor").is_err());
    }

    #[test]
    fn qdrant_bodies_match_rag_contract() {
        let tenant = TenantId(Uuid::new_v4());
        let request = RagChunkUpsert {
            id: None,
            tenant,
            corpus: "project".to_owned(),
            source: "spec".to_owned(),
            heading: "Fire rating".to_owned(),
            content: "Use approved material evidence.".to_owned(),
            embedding: vec![0.1; super::RAG_EMBEDDING_DIM],
            metadata: serde_json::json!({ "standard": "project" }),
        };
        let id = Uuid::new_v4();
        let upsert = qdrant_upsert_body(id, &request);
        assert_eq!(upsert["points"][0]["id"], id.to_string());
        assert_eq!(
            upsert["points"][0]["payload"]["tenant_id"],
            tenant.0.to_string()
        );
        assert_eq!(upsert["points"][0]["payload"]["corpus"], "project");

        let query = qdrant_query_body(
            tenant,
            &request.embedding,
            3,
            &["gb".to_owned(), "project".to_owned()],
        )
        .expect("query body should build");
        assert_eq!(query["limit"], 3);
        assert_eq!(
            query["filter"]["must"][0]["match"]["value"],
            tenant.0.to_string()
        );
        assert_eq!(query["filter"]["must"][1]["match"]["any"][1], "project");

        let create = qdrant_create_collection_body();
        assert_eq!(create["vectors"]["size"], super::RAG_EMBEDDING_DIM);
        assert_eq!(create["vectors"]["distance"], "Cosine");
    }

    #[test]
    fn qdrant_point_maps_to_chunk() {
        let id = Uuid::new_v4();
        let chunk = qdrant_chunk_from_point(&serde_json::json!({
            "id": id.to_string(),
            "score": 0.77,
            "payload": {
                "source": "gb",
                "heading": "Clause",
                "content": "Evidence text",
                "metadata": { "page": 12 }
            }
        }))
        .expect("point should map");
        assert_eq!(chunk.id, id);
        assert_eq!(chunk.source, "gb");
        assert_eq!(chunk.heading, "Clause");
        assert_eq!(chunk.content, "Evidence text");
        assert_eq!(chunk.metadata["page"], 12);
    }

    #[test]
    fn rag_vector_store_config_selects_qdrant_from_env() {
        temp_env::with_vars(
            [
                ("ARCHITOKEN_VECTOR__URL", Some("http://qdrant:6333/")),
                ("ARCHITOKEN_VECTOR__COLLECTION", Some("architoken_rag_test")),
                ("ARCHITOKEN_VECTOR__API_KEY", Some("secret")),
            ],
            || {
                let config = RagVectorStoreConfig::from_env().expect("env config should be valid");
                assert_eq!(config.provider, RagVectorStoreProvider::Qdrant);
                assert_eq!(
                    config.qdrant_endpoint.as_deref(),
                    Some("http://qdrant:6333")
                );
                assert_eq!(config.qdrant_collection, "architoken_rag_test");
                assert_eq!(config.qdrant_api_key.as_deref(), Some("secret"));
            },
        );
    }

    #[test]
    fn rag_vector_store_config_keeps_pgvector_default() {
        temp_env::with_vars(
            [
                ("ARCHITOKEN_VECTOR__PROVIDER", None::<&str>),
                ("ARCHITOKEN_VECTOR__URL", None::<&str>),
                ("QDRANT_URL", None::<&str>),
                ("ARCHITOKEN_VECTOR__COLLECTION", None::<&str>),
                ("QDRANT_COLLECTION", None::<&str>),
                ("ARCHITOKEN_VECTOR__API_KEY", None::<&str>),
                ("QDRANT_API_KEY", None::<&str>),
            ],
            || {
                let config =
                    RagVectorStoreConfig::from_env().expect("default config should be valid");
                assert_eq!(config.provider, RagVectorStoreProvider::PgVector);
                assert_eq!(config.qdrant_endpoint, None);
                assert_eq!(
                    config.qdrant_collection,
                    super::DEFAULT_QDRANT_RAG_COLLECTION
                );
            },
        );
    }
}

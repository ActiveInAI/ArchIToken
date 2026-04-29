//! RAG — Retrieval Augmented Generation over AEC knowledge.
//!
//! Embeddings are stored in Supabase `PostgreSQL` with `pgvector`. Corpus
//! includes GB 50001 series, IFC schemas (v4 + v5), and project-specific
//! specification documents.

use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement};
use serde::{Deserialize, Serialize};
use tracing::instrument;

use crate::error::{HarnessError, Result};
use crate::permissions::TenantId;

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

/// The retrieval pipeline.
pub struct RagEngine {
    db: DatabaseConnection,
    embedding_fn: Box<dyn EmbeddingFn>,
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
    /// Construct a new `RagEngine`.
    #[must_use]
    pub fn new(db: DatabaseConnection, embedding_fn: Box<dyn EmbeddingFn>) -> Self {
        Self { db, embedding_fn }
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
        let limit = i64::try_from(q.top_k)
            .map_err(|_| HarnessError::InvalidInput("top_k exceeds i64 limit".into()))?;

        let embedding = self.embedding_fn.embed(&q.text).await?;
        let embedding_str = format_vector(&embedding);

        let corpora = if q.corpora.is_empty() {
            vec!["gb".to_string(), "project".to_string()]
        } else {
            q.corpora.clone()
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
                    q.tenant.0.into(),
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

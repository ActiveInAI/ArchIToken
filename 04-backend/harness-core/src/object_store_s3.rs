//! `SeaweedFS` / S3-compatible object-store adapter.

use std::{
    collections::BTreeMap,
    fmt::Write as _,
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    time::Duration,
};

use chrono::Utc;
use reqwest::{
    Method, Url,
    header::{HeaderMap, HeaderName, HeaderValue},
};
use ring::{digest, hmac};
use serde::{Deserialize, Serialize};

use crate::{
    error::{HarnessError, Result},
    storage_router::{ObjectData, ObjectPutRequest, ObjectStat, ObjectStore},
};

const DEFAULT_REGION: &str = "us-east-1";
const SERVICE: &str = "s3";
const HTTP_TIMEOUT: Duration = Duration::from_mins(1);

/// S3-compatible object store configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct S3ObjectStoreConfig {
    /// S3 endpoint URL.
    pub endpoint: String,
    /// Access key id.
    pub access_key: String,
    /// Secret access key.
    pub secret_key: String,
    /// Default bucket.
    pub bucket: String,
}

/// S3-compatible object-store adapter.
#[derive(Debug, Clone)]
pub struct S3ObjectStore {
    config: S3ObjectStoreConfig,
}

impl S3ObjectStore {
    /// Create an S3 object-store adapter.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when required config is missing.
    pub fn new(config: S3ObjectStoreConfig) -> Result<Self> {
        for (field, value) in [
            ("endpoint", config.endpoint.as_str()),
            ("access_key", config.access_key.as_str()),
            ("secret_key", config.secret_key.as_str()),
            ("bucket", config.bucket.as_str()),
        ] {
            if value.trim().is_empty() {
                return Err(HarnessError::InvalidInput(format!(
                    "S3 object store {field} is required"
                )));
            }
        }
        Ok(Self { config })
    }

    /// Build from production runtime environment variables.
    ///
    /// # Errors
    /// Returns [`HarnessError::InvalidInput`] when any required variable is absent.
    pub fn from_env() -> Result<Self> {
        Self::new(S3ObjectStoreConfig {
            endpoint: required_env("S3_ENDPOINT")?,
            access_key: required_env("S3_ACCESS_KEY")?,
            secret_key: required_env("S3_SECRET_KEY")?,
            bucket: required_env("S3_BUCKET")?,
        })
    }

    /// Read the configured bucket.
    #[must_use]
    pub fn bucket(&self) -> &str {
        &self.config.bucket
    }

    fn object_url(&self, key: &str) -> Result<Url> {
        if key.trim().is_empty() {
            return Err(HarnessError::InvalidInput(
                "object key is required".to_owned(),
            ));
        }
        let endpoint = self.config.endpoint.trim_end_matches('/');
        let path_key = encode_s3_key(key);
        Url::parse(&format!("{endpoint}/{}/{path_key}", self.config.bucket)).map_err(|err| {
            HarnessError::InvalidInput(format!("invalid S3 object URL for key {key:?}: {err}"))
        })
    }

    fn send_signed(
        &self,
        method: &Method,
        key: &str,
        body: &[u8],
        content_type: Option<&str>,
    ) -> Result<S3HttpResponse> {
        let url = self.object_url(key)?;
        let payload_hash = sha256_hex(body);
        let now = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_scope = now.format("%Y%m%d").to_string();

        let mut signed_headers = BTreeMap::from([
            ("host".to_owned(), host_header(&url)?),
            ("x-amz-content-sha256".to_owned(), payload_hash.clone()),
            ("x-amz-date".to_owned(), amz_date.clone()),
        ]);
        if let Some(value) = content_type {
            signed_headers.insert("content-type".to_owned(), value.to_owned());
        }

        let authorization = self.authorization_header(
            method.as_str(),
            url.path(),
            url.query().unwrap_or_default(),
            &signed_headers,
            &payload_hash,
            &date_scope,
            &amz_date,
        );

        send_http_request(method.as_str(), &url, &signed_headers, &authorization, body)
    }

    #[allow(clippy::too_many_arguments)]
    fn authorization_header(
        &self,
        method: &str,
        canonical_uri: &str,
        canonical_query: &str,
        signed_headers: &BTreeMap<String, String>,
        payload_hash: &str,
        date_scope: &str,
        amz_date: &str,
    ) -> String {
        let canonical_headers =
            signed_headers
                .iter()
                .fold(String::new(), |mut out, (key, value)| {
                    let _ = writeln!(out, "{key}:{}", normalize_header_value(value));
                    out
                });
        let signed_header_names = signed_headers.keys().cloned().collect::<Vec<_>>().join(";");
        let canonical_request = format!(
            "{method}\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{signed_header_names}\n{payload_hash}"
        );
        let credential_scope = format!("{date_scope}/{DEFAULT_REGION}/{SERVICE}/aws4_request");
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
            sha256_hex(canonical_request.as_bytes())
        );
        let signing_key = signing_key(&self.config.secret_key, date_scope);
        let signature = hex_lower(&hmac_sha256(&signing_key, string_to_sign.as_bytes()));
        format!(
            "AWS4-HMAC-SHA256 Credential={}/{credential_scope}, SignedHeaders={signed_header_names}, Signature={signature}",
            self.config.access_key
        )
    }
}

impl ObjectStore for S3ObjectStore {
    fn put_object(&self, req: ObjectPutRequest) -> Result<ObjectStat> {
        let size_bytes = req.bytes.len() as u64;
        let response = self.send_signed(
            &Method::PUT,
            &req.key,
            &req.bytes,
            Some(req.content_type.as_str()),
        )?;
        ensure_success(response.status, "put_object", &req.key)?;
        let now = Utc::now();
        let headers = &response.headers;
        Ok(ObjectStat {
            key: req.key.clone(),
            uri: self.object_url(&req.key)?.to_string(),
            size_bytes: content_length(headers).unwrap_or(size_bytes),
            checksum: checksum_from_headers(headers)
                .unwrap_or_else(|| "s3-etag-unavailable".to_owned()),
            content_type: req.content_type,
            owner: req.owner,
            created_at: now,
            updated_at: now,
        })
    }

    fn get_object(&self, key: &str) -> Result<ObjectData> {
        let response = self.send_signed(&Method::GET, key, &[], None)?;
        let status = response.status;
        if status == 404 {
            return Err(HarnessError::NotFound(format!("object_key={key}")));
        }
        ensure_success(status, "get_object", key)?;
        let headers = response.headers.clone();
        let bytes = response.body;
        let now = Utc::now();
        let content_type = content_type_from_headers(&headers);
        let stat = ObjectStat {
            key: key.to_owned(),
            uri: self.object_url(key)?.to_string(),
            size_bytes: bytes.len() as u64,
            checksum: checksum_from_headers(&headers).unwrap_or_else(|| sha256_hex(&bytes)),
            content_type: content_type.clone(),
            owner: "s3".to_owned(),
            created_at: now,
            updated_at: now,
        };
        Ok(ObjectData {
            key: key.to_owned(),
            bytes,
            content_type,
            stat,
        })
    }

    fn stat_object(&self, key: &str) -> Result<ObjectStat> {
        let response = self.send_signed(&Method::HEAD, key, &[], None)?;
        let status = response.status;
        if status == 404 {
            return Err(HarnessError::NotFound(format!("object_key={key}")));
        }
        ensure_success(status, "stat_object", key)?;
        let now = Utc::now();
        let headers = &response.headers;
        Ok(ObjectStat {
            key: key.to_owned(),
            uri: self.object_url(key)?.to_string(),
            size_bytes: content_length(headers).unwrap_or_default(),
            checksum: checksum_from_headers(headers)
                .unwrap_or_else(|| "s3-etag-unavailable".to_owned()),
            content_type: content_type_from_headers(headers),
            owner: "s3".to_owned(),
            created_at: now,
            updated_at: now,
        })
    }
}

#[derive(Debug)]
struct S3HttpResponse {
    status: u16,
    headers: HeaderMap,
    body: Vec<u8>,
}

fn send_http_request(
    method: &str,
    url: &Url,
    signed_headers: &BTreeMap<String, String>,
    authorization: &str,
    body: &[u8],
) -> Result<S3HttpResponse> {
    if url.scheme() != "http" {
        return Err(HarnessError::InvalidInput(format!(
            "S3 endpoint scheme {:?} is not supported by the synchronous object-store adapter",
            url.scheme()
        )));
    }
    let host = url
        .host_str()
        .ok_or_else(|| HarnessError::InvalidInput("S3 endpoint host is required".to_owned()))?;
    let port = url.port_or_known_default().unwrap_or(80);
    let address = (host, port).to_socket_addrs()?.next().ok_or_else(|| {
        HarnessError::Upstream(format!("S3 endpoint {host}:{port} did not resolve"))
    })?;
    let mut stream = TcpStream::connect_timeout(&address, HTTP_TIMEOUT)?;
    stream.set_read_timeout(Some(HTTP_TIMEOUT))?;
    stream.set_write_timeout(Some(HTTP_TIMEOUT))?;

    let mut target = url.path().to_owned();
    if target.is_empty() {
        target.push('/');
    }
    if let Some(query) = url.query() {
        target.push('?');
        target.push_str(query);
    }

    let mut request = format!("{method} {target} HTTP/1.1\r\n");
    request.push_str("authorization: ");
    request.push_str(&normalize_header_value(authorization));
    request.push_str("\r\n");
    for (key, value) in signed_headers {
        request.push_str(key);
        request.push_str(": ");
        request.push_str(&normalize_header_value(value));
        request.push_str("\r\n");
    }
    let _ = write!(
        request,
        "content-length: {}\r\nconnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(request.as_bytes())?;
    if !body.is_empty() {
        stream.write_all(body)?;
    }
    stream.flush()?;

    let mut response = Vec::new();
    stream.read_to_end(&mut response)?;
    parse_http_response(&response)
}

fn parse_http_response(bytes: &[u8]) -> Result<S3HttpResponse> {
    let header_end = bytes
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .ok_or_else(|| {
            HarnessError::Upstream("S3 response did not contain HTTP headers".to_owned())
        })?;
    let head = String::from_utf8_lossy(&bytes[..header_end]);
    let body = bytes[header_end + 4..].to_vec();
    let mut lines = head.split("\r\n");
    let status_line = lines
        .next()
        .ok_or_else(|| HarnessError::Upstream("S3 response was empty".to_owned()))?;
    let status = status_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| HarnessError::Upstream(format!("invalid S3 status line: {status_line}")))?
        .parse::<u16>()
        .map_err(|err| HarnessError::Upstream(format!("invalid S3 status code: {err}")))?;

    let mut headers = HeaderMap::new();
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        let header_name = HeaderName::from_bytes(name.trim().as_bytes()).map_err(|err| {
            HarnessError::Upstream(format!("invalid S3 response header {name:?}: {err}"))
        })?;
        let header_value = HeaderValue::from_str(value.trim()).map_err(|err| {
            HarnessError::Upstream(format!(
                "invalid S3 response header value for {name:?}: {err}"
            ))
        })?;
        headers.append(header_name, header_value);
    }

    Ok(S3HttpResponse {
        status,
        headers,
        body,
    })
}

fn required_env(key: &str) -> Result<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| HarnessError::InvalidInput(format!("{key} is required")))
}

fn ensure_success(status: u16, operation: &str, key: &str) -> Result<()> {
    if (200..300).contains(&status) {
        Ok(())
    } else {
        Err(HarnessError::Upstream(format!(
            "S3 {operation} failed for key {key:?}: HTTP {status}"
        )))
    }
}

fn host_header(url: &Url) -> Result<String> {
    let host = url
        .host_str()
        .ok_or_else(|| HarnessError::InvalidInput("S3 endpoint host is required".to_owned()))?;
    Ok(url
        .port()
        .map_or_else(|| host.to_owned(), |port| format!("{host}:{port}")))
}

fn encode_s3_key(key: &str) -> String {
    key.split('/')
        .map(percent_encode_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_encode_segment(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        if matches!(byte, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~') {
            encoded.push(char::from(byte));
        } else {
            let _ = write!(encoded, "%{byte:02X}");
        }
    }
    encoded
}

fn normalize_header_value(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn content_length(headers: &HeaderMap) -> Option<u64> {
    headers
        .get("content-length")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
}

fn content_type_from_headers(headers: &HeaderMap) -> String {
    headers
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("application/octet-stream")
        .to_owned()
}

fn checksum_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get("etag")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim_matches('"').to_owned())
        .filter(|value| !value.is_empty())
}

fn sha256_hex(bytes: impl AsRef<[u8]>) -> String {
    hex_lower(digest::digest(&digest::SHA256, bytes.as_ref()).as_ref())
}

fn signing_key(secret_key: &str, date_scope: &str) -> Vec<u8> {
    let k_date = hmac_sha256(
        format!("AWS4{secret_key}").as_bytes(),
        date_scope.as_bytes(),
    );
    let k_region = hmac_sha256(&k_date, DEFAULT_REGION.as_bytes());
    let k_service = hmac_sha256(&k_region, SERVICE.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> Vec<u8> {
    let key = hmac::Key::new(hmac::HMAC_SHA256, key);
    hmac::sign(&key, message).as_ref().to_vec()
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut out, byte| {
        let _ = write!(out, "{byte:02x}");
        out
    })
}

#[cfg(test)]
mod tests {
    use super::{S3ObjectStore, S3ObjectStoreConfig, encode_s3_key};
    use crate::storage_router::{ObjectPutRequest, ObjectStore};

    #[test]
    fn s3_config_requires_bucket() {
        let err = S3ObjectStore::new(S3ObjectStoreConfig {
            endpoint: "http://localhost:8333".to_owned(),
            access_key: "key".to_owned(),
            secret_key: "secret".to_owned(),
            bucket: String::new(),
        })
        .expect_err("empty bucket should fail");
        assert_eq!(err.http_status(), 400);
    }

    #[test]
    fn s3_key_encoding_preserves_path_segments() {
        assert_eq!(
            encode_s3_key("tenant/project/图纸 A.ifc"),
            "tenant/project/%E5%9B%BE%E7%BA%B8%20A.ifc"
        );
    }

    #[tokio::test]
    async fn s3_adapter_constructs_inside_tokio_runtime() {
        let store = S3ObjectStore::new(S3ObjectStoreConfig {
            endpoint: "http://localhost:8333".to_owned(),
            access_key: "test-access".to_owned(),
            secret_key: "test-secret".to_owned(),
            bucket: "architoken-assets".to_owned(),
        })
        .expect("s3 store inside async runtime");
        assert_eq!(store.bucket(), "architoken-assets");
    }

    #[test]
    #[allow(clippy::significant_drop_tightening)]
    fn s3_adapter_puts_and_gets_real_http_objects() {
        let mut server = mockito::Server::new();
        let put = server
            .mock("PUT", "/architoken-assets/tenant/project/model.ifc")
            .match_header(
                "authorization",
                mockito::Matcher::Regex("AWS4-HMAC-SHA256.*".to_owned()),
            )
            .match_header("x-amz-content-sha256", mockito::Matcher::Any)
            .with_status(200)
            .with_header("etag", "ifc-etag")
            .create();
        let get = server
            .mock("GET", "/architoken-assets/tenant/project/model.ifc")
            .match_header(
                "authorization",
                mockito::Matcher::Regex("AWS4-HMAC-SHA256.*".to_owned()),
            )
            .with_status(200)
            .with_header("content-type", "model/ifc")
            .with_header("etag", "ifc-etag")
            .with_body("ISO-10303-21;")
            .create();
        let store = S3ObjectStore::new(S3ObjectStoreConfig {
            endpoint: server.url(),
            access_key: "test-access".to_owned(),
            secret_key: "test-secret".to_owned(),
            bucket: "architoken-assets".to_owned(),
        })
        .expect("s3 store");
        let stat = store
            .put_object(ObjectPutRequest {
                key: "tenant/project/model.ifc".to_owned(),
                bytes: b"ISO-10303-21;".to_vec(),
                content_type: "model/ifc".to_owned(),
                owner: "tester".to_owned(),
            })
            .expect("put object through signed HTTP");
        assert_eq!(stat.checksum, "ifc-etag");
        let object = store
            .get_object("tenant/project/model.ifc")
            .expect("get object through signed HTTP");
        assert_eq!(object.bytes, b"ISO-10303-21;");
        assert_eq!(object.content_type, "model/ifc");
        put.assert();
        get.assert();
    }
}

# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ |
| 1.x     | ❌ (deprecated) |

## Reporting a vulnerability

Please email `ActiveInAI@outlook.com` with the subject `[SECURITY] <short title>`. Do **not** file a public GitHub issue.

We will:

1. Acknowledge receipt within 48 hours
2. Triage and confirm within 7 days
3. Publish a fix and CVE (if applicable) within 30 days for HIGH/CRITICAL, 90 days for MEDIUM/LOW

Hall of fame: `SECURITY_HALL_OF_FAME.md` (once there's a first entry).

## Threat model (abridged)

ArchIToken operates under these assumptions:

- The network is hostile. Production service-to-service communication must use explicit trust boundaries and mutually authenticated channels where available.
- Any tenant may be compromised. Tenant isolation, RBAC/ABAC and row-level protections are mandatory for production data.
- Uploaded engineering files are untrusted. CAD, BIM, Office, PDF, media and point-cloud parsing must run through sandboxed workers or reviewed adapters.
- LLMs and agents can be prompt-injected. Structured output, tool allowlists, schema validation, evaluator separation and human approval gates mitigate this.
- Vendor model providers are untrusted runtime adapters. OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, vLLM, LM Studio and others must stay behind ModelRouter / InferenceRouter boundaries.
- The supply chain is attackable. Dependencies, containers, workers and generated SDKs need lockfiles, SBOMs, license checks and provenance where practical.
- Audit records are security records. File operations, lifecycle transitions, approvals, model calls, tool calls and worker derivatives must be traceable.

## High-priority security areas

Please report issues in these areas privately:

- Cross-tenant data exposure or broken authorization.
- Prompt injection that reaches tools, files, secrets, deployment config or privileged workflows.
- Parser escape, worker sandbox bypass or malicious file execution.
- Model/router bypass that sends private data to an unintended provider.
- Tampering with audit logs, approvals, lifecycle state or generated deliverables.
- License or supply-chain issues that would contaminate distributed runtime.
- Secrets committed to the repository or exposed through logs, traces, screenshots or artifacts.

## Out of scope

- Denial of service from abusive tenants (rate-limited at ingress)
- Social engineering of operators (see runbook §5)
- Physical access to DGX Spark machines
- Feature requests, product-positioning disputes or unsupported competitor claims

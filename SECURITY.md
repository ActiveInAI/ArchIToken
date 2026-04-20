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

InsomeOS operates under these assumptions:

- The network is hostile (mutual TLS between services in prod)
- Any tenant may be compromised (Constitution §16 RLS is mandatory)
- LLMs can be prompt-injected (structured output + tool allowlist mitigate)
- The supply chain is attackable (every dep pinned, SBOM published per release)

## Out of scope

- Denial of service from abusive tenants (rate-limited at ingress)
- Social engineering of operators (see runbook §5)
- Physical access to DGX Spark machines

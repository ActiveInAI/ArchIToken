# ArchIToken SDKs · 7 Languages

**Single source of truth**: [`04-backend/openapi.yaml`](../04-backend/openapi.yaml) (Constitution §5)

All SDKs are **machine-generated**. Do NOT edit files under `typescript/`, `python/`, `rust/`, `go/`, `java/`, `swift/`, or `kotlin/` by hand — they are regenerated on every `main` merge and your changes will be lost.

## Regenerate

```bash
cd 08-sdk
npm install -g @openapitools/openapi-generator-cli@2.23.0
openapi-generator-cli version-manager set 7.14.0
openapi-generator-cli generate-all -c openapitools.json
```

Or via CI — every tag `v*.*.*` push triggers `release.yml` which:
1. Regenerates all 7 SDKs
2. Publishes them:
   - TypeScript → npm (`@architoken/sdk`)
   - Python → PyPI (`architoken-sdk`)
   - Rust → crates.io (`architoken-sdk`)
   - Go → GitHub release + `go get github.com/ActiveInAI/architoken-sdk-go`
   - Java → Maven Central (`io.architoken:architoken-sdk`)
   - Swift → Swift Package Registry
   - Kotlin → Maven Central (`io.architoken:architoken-sdk-kotlin`)

## Verify contract

Before cutting a release, diff against the previous SDK to catch breaking changes:

```bash
openapi-generator-cli validate -i ../04-backend/openapi.yaml
```

## Install (consumers)

| Language | Command |
|----------|---------|
| TypeScript | `bun add @architoken/sdk@2.0.0` |
| Python | `pip install architoken-sdk==2.0.0` |
| Rust | `cargo add architoken-sdk@=2.0.0` |
| Go | `go get github.com/ActiveInAI/architoken-sdk-go@v2.0.0` |
| Java | Gradle: `implementation 'io.architoken:architoken-sdk:2.0.0'` |
| Swift | SPM: `.package(url: "...", from: "2.0.0")` |
| Kotlin | `implementation("io.architoken:architoken-sdk-kotlin:2.0.0")` |

## Minimal usage (TypeScript)

```ts
import { Configuration, HarnessApi } from '@architoken/sdk';

const api = new HarnessApi(
  new Configuration({
    basePath: 'https://api.architoken.io',
    accessToken: process.env.ARCHITOKEN_TOKEN,
  })
);

const res = await api.v1HarnessInvokePost({
  chatRequest: {
    model: 'claude-4.7-sonnet',
    messages: [{ role: 'user', content: 'hello' }],
  },
});

console.log(res.content);
```

## Versioning

SDK versions track the OpenAPI spec's `info.version` field. A breaking API change (removed field, renamed endpoint, type change) bumps MAJOR. Additions bump MINOR. Doc-only changes bump PATCH.

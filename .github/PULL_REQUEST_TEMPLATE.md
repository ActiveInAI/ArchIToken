<!-- Open this template when filing a pull request. -->

## Summary

<!-- What does this PR do in one sentence? -->

## Why

<!-- What problem does it solve? Which issue/RFC does it close? -->
Closes #

## Constitution compliance checklist

- [ ] § 3  — No new AGPL / GPL / LGPL / SSPL / BUSL dependency (`cargo deny check` passes)
- [ ] § 4  — Development dependencies use bounded compatible ranges where needed; release/CI/deployment artifacts are reproducible via lockfiles, constraints, image digests or explicit release tags
- [ ] § 5  — If an API surface changed, `04-backend/openapi.yaml` is updated and SDKs regenerated
- [ ] § 6  — No new cross-layer / reverse imports introduced
- [ ] § 7  — If adding an inference engine, it implements `ChatCompletion` + passes `compat_suite`
- [ ] § 9  — Generator and evaluator models stay distinct
- [ ] § 10 — Any new model id is on the whitelist (or is being added via RFC)
- [ ] § 12 — Frontend stays single-path (Next.js + React)
- [ ] § 13 — `AGENTS.md` stays < 100 lines
- [ ] § 14 — Evaluator prompts express constraints, not recipes
- [ ] § 16 — Any new tenant-scoped table has RLS enabled + forced + policy

## Testing

<!-- How did you verify this works? Paste command output, screenshots, or test names. -->

## Screenshots / output

<!-- Optional but appreciated for UI / UX changes. -->

## Rollback plan

<!-- If this lands and breaks prod, what's the fastest way back? Refer to 07-deployment/runbook.md §2.4. -->

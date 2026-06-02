# OpenAI And CIMD Source Inventory

Status: active source inventory.

Verified date: 2026-05-25.

This inventory records the user-supplied OpenAI and Hugging Face sources for ArchIToken. It does not change the project identity: ArchIToken development instructions remain GPT / Codex through `AGENTS.md`, and runtime model providers remain adapters behind ModelRouter / InferenceRouter.

## Source Boundaries

| Source | Current fact | ArchIToken route |
|---|---|---|
| `https://github.com/openai/symphony` | Public OpenAI repository, Apache-2.0, Elixir, default branch `main`; describes isolated autonomous implementation runs for project work | Selected source-sync and isolated workflow/orchestration service candidate behind WorkflowRouter, ToolRouter, audit and approvals |
| `https://github.com/openai` | Public OpenAI organization source set; currently exposes hundreds of public repositories with mixed licenses and maturity | Selected organization source inventory; concrete repos must be classified before runtime use |
| `https://huggingface.co/datasets/opencsg/CIMD` | Public Hugging Face dataset, license tag `other`, sha `2123e5aa1e1b193fd14b710de9fcb74b20092460`, last modified `2026-05-24`; metadata synced by `hf download` without downloading the 3 GB corpus | Licensed-gated dataset source for DataRouter / KnowledgeRouter; no production RAG, training, fine-tuning, API serving or redistribution until license and source governance pass |

Evidence:

| Source sync | Evidence |
|---|---|
| `openai-symphony-source-sync` | `/tmp/architoken-source-builds/openai-symphony-source-sync/source-build-evidence.json` |
| `openai-ai-source-sync` | `/tmp/architoken-source-builds/openai-ai-source-sync/source-build-evidence.json` |
| `opencsg-cimd-dataset-metadata` | `/tmp/architoken-source-builds/opencsg-cimd-dataset-metadata` |

## OpenAI Organization Use

OpenAI source use is split by capability:

| Capability family | Candidate repositories | Boundary |
|---|---|---|
| API / SDK contracts | `openai-openapi`, `openai-python`, `openai-node`, `openai-go`, `openai-java`, `openai-ruby`, `openai-dotnet` | Reference or adapter source behind ModelRouter / InferenceRouter; no direct vendor calls in business logic |
| Agent / orchestration | `symphony`, `codex`, `openai-agents-python`, `swarm`, realtime agent samples | WorkflowRouter / ToolRouter inputs; agent actions still require Approver and audit state |
| Evaluation / safety | `simple-evals`, `frontier-evals`, `human-eval`, `prm800k`, `model_spec` | Evaluation corpus and policy references behind Evaluator / RuleChecker; not professional compliance proof by itself |
| Media / ML utilities | `whisper`, `tiktoken`, `CLIP`, `point-e`, `shap-e`, diffusion examples | Worker adapter candidates; model/data/license must be reviewed per repo before runtime |

Archived, GPL, unknown-license or `NOASSERTION` repositories in the OpenAI organization are not embedded into distributed runtime. If a foundational capability is still required, it must be isolated as a process, service, container or licensed-gated adapter.

The first source sync intentionally uses a selected 22-repository set rather than cloning every public OpenAI repository. `openai-cookbook` remains a documentation/example reference in this inventory, but it is not part of the initial source-build sync because its large history slowed the evidence run and examples must still be converted into governed adapters before runtime use.

## CIMD Dataset Gate

The synced `dataset_manifest.json` records:

| Field | Value |
|---|---|
| `total_records` | `379648` |
| `kept_records` | `111308` |
| `release_filter` | `strict metadata and text filter` |
| `unique_file_ids` | `9655` |
| `source_type_count` | `35` |
| Local metadata path | `/tmp/architoken-source-builds/opencsg-cimd-dataset-metadata` |

The seven public subsets are:

| Subset | Records | Path |
|---|---:|---|
| `reference_governance` | `90197` | `data/corpus/reference_governance/train.jsonl` |
| `scholarly_literature` | `17569` | `data/corpus/scholarly_literature/train.jsonl` |
| `enterprise_operations` | `1744` | `data/corpus/enterprise_operations/train.jsonl` |
| `public_discourse` | `1286` | `data/corpus/public_discourse/train.jsonl` |
| `institutional_analysis` | `484` | `data/corpus/institutional_analysis/train.jsonl` |
| `market_observations` | `20` | `data/corpus/market_observations/train.jsonl` |
| `miscellaneous_records` | `8` | `data/corpus/miscellaneous_records/train.jsonl` |

Required gates before ingestion:

1. Preserve source metadata, license marks, source paths, language, time fields and dataset version.
2. Do not redistribute the dataset, substantial subsets, cached indexes, vector stores or API outputs that can reconstruct the dataset.
3. Run PII, copyright, source-rights, cross-border, cyber/data-security and tenant-isolation review before any production RAG or training use.
4. Use this dataset for internal research, validation, evaluation or governed retrieval only after DataRouter and KnowledgeRouter attach audit evidence.
5. Any external commercial product, API, hosted retrieval service, model, agent or generated system using the dataset requires a separate commercial/license review.

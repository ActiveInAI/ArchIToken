# InsomeOS Agent Index (§13)

< 100 lines · This file is an **index**, not a manual.

## Roles (per Harness 哲学)
- `planner` — decomposes user request into 3–7 concrete steps
- `generator` — executes the plan, produces the phase deliverable
- `evaluator` — independently judges the generator output (§9: different model)

## Loading
Prompts are loaded on demand via `insomeos_agent.prompts.load(name)`:
- `prompts/<phase>/planner.md`
- `prompts/<phase>/generator.md`
- `prompts/<phase>/evaluator.md`

## Phase keys (`BusinessPhase`)
| key | 中文 | focus |
|-----|------|------|
| pre_sales | 售前 | 报价 + 初版方案 |
| concept | 方案 | 3 方案 + 3D + 造价估 |
| develop | 深化 | BIM (IFC4) + 施工图 |
| costing | 造价 | BOQ + 报价 Excel |
| fabrication | 制造 | CNC + BOM |
| logistics | 物流 | 运输 + 吊装 |
| construction | 施工 | 4D 进度 + 班组 |
| acceptance | 验收 | 合规 + 整改 |
| operations | 运维 | 数字孪生 + IoT |

## Model assignment (default)
- planner → `claude-4.7-sonnet`
- generator → `gpt-5.2`
- evaluator → `claude-4.7-opus` (§9 requires different from generator)

## Hard constraints (every prompt inherits)
- Output MUST be in the user's `locale` (zh-CN default)
- No chain-of-thought leakage in final output
- Refuse if regulation code is unknown; never fabricate clause numbers
- All numeric values require units and a source citation

Full constitution: `02-architecture/CONSTITUTION.md`
Architecture: `02-architecture/ARCHITECTURE.md`
Product: `01-product/PRD.md`

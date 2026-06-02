# ArchIToken Agent Index (§13)

< 100 lines · This file is an **index**, not a manual.

## Roles
- `planner` — decomposes user request into 3–7 concrete steps
- `generator` — executes the plan and produces the module deliverable
- `evaluator` — independently judges the generator output (§9: different model)

## Loading
Prompts are loaded on demand via `architoken_agent.prompts.load(name)`:
- `prompts/<module_id>/planner.md`
- `prompts/<module_id>/generator.md`
- `prompts/<module_id>/evaluator.md`

## Active Module IDs
1. `personal_center`
2. `marketing_service`
3. `planning_management`
4. `concept_design`
5. `standard_library`
6. `detailed_design`
7. `quantity_costing`
8. `material_logistics`
9. `production_manufacturing`
10. `construction_management`
11. `digital_twin`
12. `digital_archive`
13. `finance_management`
14. `human_resources`
15. `ai_center`
16. `settings_center`

## Model Assignment
- planner -> `architoken-planner`
- generator -> `architoken-generator`
- evaluator -> `architoken-evaluator` (§9 requires different from generator)

Provider-specific model versions are runtime deployment config, not prompt docs.

## Hard Constraints
- Output MUST be in the user's `locale` (`zh-CN` default)
- No chain-of-thought leakage in final output
- Refuse if regulation code is unknown; never fabricate clause numbers
- All numeric values require units and a source citation

Full constitution: `02-architecture/CONSTITUTION.md`
Architecture: `02-architecture/ARCHITECTURE.md`
Product: `01-product/PRD.md`

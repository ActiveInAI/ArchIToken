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
1. `marketing_service`
2. `planning_management`
3. `concept_design`
4. `standard_library`
5. `detailed_design`
6. `quantity_costing`
7. `material_logistics`
8. `production_manufacturing`
9. `construction_supervision`
10. `digital_twin`
11. `digital_archive`
12. `finance_hr`
13. `ai_center`
14. `settings_center`

## Model Assignment
- planner -> `claude-4.7-sonnet`
- generator -> `gpt-5.2`
- evaluator -> `claude-4.7-opus` (§9 requires different from generator)

## Hard Constraints
- Output MUST be in the user's `locale` (`zh-CN` default)
- No chain-of-thought leakage in final output
- Refuse if regulation code is unknown; never fabricate clause numbers
- All numeric values require units and a source citation

Full constitution: `02-architecture/CONSTITUTION.md`
Architecture: `02-architecture/ARCHITECTURE.md`
Product: `01-product/PRD.md`

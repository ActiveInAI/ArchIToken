# Costing · Planner

Plan the **造价 (costing)** module: converting BIM into a detailed Bill of Quantities.

## Steps
- Parse BIM element list; group by GB 50500 quantity codes
- Query current market prices per region (RAG corpus `project` + `market`)
- Compute quantities: volume/area/length per element type
- Apply waste factors (typ. 3% steel, 5% concrete, 8% finishes)
- Produce unit prices + totals; compute tax separately (13% VAT CN / user locale)
- Plan Excel sheet layout: 分部 → 分项 → 项目 → 明细

Output: 5-7 bullets.

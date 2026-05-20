# Detailed Design · Evaluator

Return JSON `{"verdict", "notes"}`.

## APPROVED if
- IFC4.3 or other approved IFC schema is declared
- The 100-room Q235B full-bolted hotel baseline is stated
- The 8 drawing packages and total 198 sheets are represented
- P1先行 blockers are separated and include steel structure, bolted joints, module split, shop drawings, MEP penetrations, BOM and embedded parts
- SS-04-05 is cross-referenced with MEP penetration locking and double-sign confirmation
- Outputs are marked `professional_review_required` or equivalent, not construction-ready

## REVISE if
- A package, stage, owner role, priority, or gate is missing but recoverable
- A P1 blocker is listed without evidence or owner
- A clause cites a real GB but wrong number

## REJECTED if
- An invented regulation code appears
- The output changes Q235B/full-bolted/no-onsite-welding baseline without source evidence
- It allows steel production ordering before P1 steel detailing is frozen
- It claims施工-ready/报审-ready/合规 without professional signoff

Max 800 chars notes.

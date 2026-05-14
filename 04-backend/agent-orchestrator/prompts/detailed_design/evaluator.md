# Develop · Evaluator

Return JSON `{"verdict", "notes"}`.

## APPROVED if
- IFC4 schema declared
- Every structural element has material, section, and length/area
- Code-check table cites real GB clauses
- Drawing list is complete for the scheme complexity

## REVISE if
- An element is missing material or section
- A clause cites a real GB but wrong number

## REJECTED if
- An invented regulation code appears
- Section is clearly undersized (obvious failure)
- Drawing list omits structural sheets for a structural project

Max 800 chars notes.

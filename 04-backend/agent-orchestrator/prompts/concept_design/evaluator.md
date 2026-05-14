# Concept · Evaluator

Judge the 3-scheme output. Return JSON `{"verdict", "notes"}`.

## APPROVED if
- 3 schemes are topologically distinct
- Each scheme has strategy, plan, massing, cost, fit
- Comparison matrix is complete across 4 dimensions
- Recommendation logic matches the matrix

## REVISE if
- Schemes differ only cosmetically
- Cost estimates differ by < 5% (unrealistic)
- Recommendation contradicts the matrix

## REJECTED if
- A scheme violates code setbacks
- Room sizes are dimensionless or impossible
- Language is wrong

Notes: specific, cite headings. Max 800 chars.

# Production Manufacturing · Evaluator

Return JSON `{"verdict", "notes"}`.

APPROVED if: every piece has mark, qty, section, length, mat, weight; connections classified; CNC format specified; weld classes cited to GB 50205.
REVISE if: minor spec gaps, weight sums off ±1%.
REJECTED if: non-standard sections; invented bolt grades; wrong welding code.

Max 800 chars.

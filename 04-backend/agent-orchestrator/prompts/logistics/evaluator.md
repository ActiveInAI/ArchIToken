# Logistics · Evaluator

Return JSON `{"verdict","notes"}`.

APPROVED if: every truck within load + length limits; crane radii feasible; hoisting sequence respects gravity.
REVISE if: missing wind limit; one item overloads.
REJECTED if: crane capacity insufficient at any pick; sequence violates physics.

Max 800 chars.

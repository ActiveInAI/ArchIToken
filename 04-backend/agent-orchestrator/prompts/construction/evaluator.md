# Construction · Evaluator

Return JSON `{"verdict","notes"}`.

APPROVED if: critical path computable; milestones ≥ sum of predecessors; hold points cover code-required ones.
REVISE if: one duration absent; buffer omitted.
REJECTED if: dependencies violated (child starts before parent); milestone pulled earlier than critical path.

Max 800 chars.

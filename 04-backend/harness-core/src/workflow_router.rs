//! `WorkflowRouter` — selects a workflow template and the fixed agent gate chain
//! for a business object.
//!
//! It encodes the non-negotiable governance rules: the six-gate chain (Generator
//! never self-evaluates), mandatory human approval for professional deliverables,
//! and "downstream only consumes `issued`". Registry over Enum: object kinds and
//! their templates live in a data table, so new object types are added without
//! spreading lifecycle branches across modules.

use serde::Serialize;

/// The fixed agent gate chain (Constitution §AI gate). Order is invariant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentGate {
    /// Decompose the task, resolve sources, permissions and tools.
    Planner,
    /// Produce the candidate artifact.
    Generator,
    /// Independently score the artifact (never the same model as Generator).
    Evaluator,
    /// Apply deterministic business/standard rules.
    RuleChecker,
    /// Validate against JSON/IFC/module/API schema contracts.
    SchemaValidator,
    /// Human or auto approval gate; nothing publishes without it.
    Approver,
}

/// The canonical, invariant six-gate chain.
pub const GATE_CHAIN: [AgentGate; 6] = [
    AgentGate::Planner,
    AgentGate::Generator,
    AgentGate::Evaluator,
    AgentGate::RuleChecker,
    AgentGate::SchemaValidator,
    AgentGate::Approver,
];

/// Business object kind the workflow routes for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowObjectKind {
    /// Captured customer requirement / demand item.
    Requirement,
    /// Concept design variant.
    Concept,
    /// Construction or fabrication drawing / view.
    Drawing,
    /// Engineering model element / IFC model.
    Model,
    /// Component material BOM (document/version/line).
    ComponentBom,
    /// Bill of quantities / cost breakdown.
    Boq,
    /// Commercial quotation.
    Quote,
    /// Procurement request / purchase order.
    PurchaseRequest,
    /// Manufacturing work order / cutting list / QC record.
    WorkOrder,
    /// Site installation / acceptance / rectification record.
    AcceptanceRecord,
    /// Sealed archive package / item.
    ArchivePackage,
    /// Any other governed object.
    Generic,
}

/// Auditable workflow routing decision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRoutingDecision {
    /// Owning module id.
    pub module_id: String,
    /// Resolved business object kind.
    pub object_kind: WorkflowObjectKind,
    /// Module-scoped workflow template id.
    pub template_id: String,
    /// The fixed six-gate chain (always present, invariant order).
    pub gate_chain: Vec<AgentGate>,
    /// Professional deliverables must be human-approved (AI may not auto-approve).
    pub requires_human_approval: bool,
    /// The lifecycle state that makes the object consumable downstream.
    pub downstream_consumable_state: String,
    /// Unresolved blockers prevent issue/archive.
    pub blocks_on_unresolved: bool,
    /// Human-readable routing rationale.
    pub reason: String,
}

/// One object-kind workflow policy row.
#[derive(Debug, Clone, Copy)]
struct WorkflowRoute {
    object_kind: WorkflowObjectKind,
    /// Object-type aliases that map to this kind.
    aliases: &'static [&'static str],
    requires_human_approval: bool,
}

const WORKFLOW_ROUTES: &[WorkflowRoute] = &[
    WorkflowRoute {
        object_kind: WorkflowObjectKind::Requirement,
        aliases: &["requirement", "customer_requirement", "demand_item"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::Concept,
        aliases: &["concept", "concept_variant"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::Drawing,
        aliases: &[
            "drawing",
            "drawing_view",
            "construction_drawing",
            "fabrication_drawing",
        ],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::Model,
        aliases: &["model", "model_element", "ifc_model", "element_type"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::ComponentBom,
        aliases: &["component_bom", "bom", "bom_version", "bom_line"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::Boq,
        aliases: &["boq", "boq_item", "cost_breakdown"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::Quote,
        aliases: &["quote", "quote_line", "quote_version"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::PurchaseRequest,
        aliases: &["purchase_request", "purchase_order", "purchase_plan"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::WorkOrder,
        aliases: &["work_order", "cutting_list", "cnc_file", "qc_record"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::AcceptanceRecord,
        aliases: &["acceptance_record", "installation_task", "rectification"],
        requires_human_approval: true,
    },
    WorkflowRoute {
        object_kind: WorkflowObjectKind::ArchivePackage,
        aliases: &["archive_package", "archive_item"],
        requires_human_approval: true,
    },
];

/// `WorkflowRouter` component.
#[derive(Debug, Clone, Copy, Default)]
pub struct WorkflowRouter;

impl WorkflowRouter {
    /// Create a new `WorkflowRouter`.
    #[must_use]
    pub const fn new() -> Self {
        Self
    }

    /// Route a business object to its workflow template and gate chain.
    /// Unknown object types route to a governed `Generic` template (never bypassed).
    #[must_use]
    pub fn route(&self, module_id: &str, object_type: &str) -> WorkflowRoutingDecision {
        route_workflow(module_id, object_type)
    }
}

/// Free-function form of [`WorkflowRouter::route`].
#[must_use]
pub fn route_workflow(module_id: &str, object_type: &str) -> WorkflowRoutingDecision {
    let key = object_type.trim().to_ascii_lowercase();
    let (object_kind, requires_human_approval) = WORKFLOW_ROUTES
        .iter()
        .find(|route| route.aliases.contains(&key.as_str()))
        .map_or(
            // Unknown objects still route through a governed template — never bypassed.
            (WorkflowObjectKind::Generic, true),
            |route| (route.object_kind, route.requires_human_approval),
        );
    let template_id = format!("{module_id}.{}", kind_slug(object_kind));
    let reason = format!(
        "module={module_id} object_type={key} -> kind={object_kind:?}; six-gate chain enforced; \
         requires_human_approval={requires_human_approval}; downstream consumes `issued` only."
    );
    WorkflowRoutingDecision {
        module_id: module_id.to_owned(),
        object_kind,
        template_id,
        gate_chain: GATE_CHAIN.to_vec(),
        requires_human_approval,
        downstream_consumable_state: "issued".to_owned(),
        blocks_on_unresolved: true,
        reason,
    }
}

const fn kind_slug(kind: WorkflowObjectKind) -> &'static str {
    match kind {
        WorkflowObjectKind::Requirement => "requirement",
        WorkflowObjectKind::Concept => "concept",
        WorkflowObjectKind::Drawing => "drawing",
        WorkflowObjectKind::Model => "model",
        WorkflowObjectKind::ComponentBom => "component_bom",
        WorkflowObjectKind::Boq => "boq",
        WorkflowObjectKind::Quote => "quote",
        WorkflowObjectKind::PurchaseRequest => "purchase_request",
        WorkflowObjectKind::WorkOrder => "work_order",
        WorkflowObjectKind::AcceptanceRecord => "acceptance_record",
        WorkflowObjectKind::ArchivePackage => "archive_package",
        WorkflowObjectKind::Generic => "generic",
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentGate, GATE_CHAIN, WorkflowObjectKind, WorkflowRouter};

    #[test]
    fn gate_chain_is_the_fixed_six_and_generator_precedes_evaluator() {
        let decision = WorkflowRouter::new().route("detailed_design", "component_bom");
        assert_eq!(decision.gate_chain, GATE_CHAIN.to_vec());
        let generator_idx = decision
            .gate_chain
            .iter()
            .position(|g| *g == AgentGate::Generator)
            .unwrap();
        let evaluator_idx = decision
            .gate_chain
            .iter()
            .position(|g| *g == AgentGate::Evaluator)
            .unwrap();
        assert!(
            generator_idx < evaluator_idx,
            "Generator must run before Evaluator (no self-evaluation)"
        );
        assert_eq!(*decision.gate_chain.last().unwrap(), AgentGate::Approver);
    }

    #[test]
    fn known_objects_route_to_their_kind_and_require_approval() {
        let router = WorkflowRouter::new();
        assert_eq!(
            router.route("detailed_design", "bom_line").object_kind,
            WorkflowObjectKind::ComponentBom
        );
        assert_eq!(
            router.route("quantity_costing", "boq_item").object_kind,
            WorkflowObjectKind::Boq
        );
        assert!(
            router
                .route("material_logistics", "purchase_order")
                .requires_human_approval
        );
        assert_eq!(
            router
                .route("detailed_design", "component_bom")
                .downstream_consumable_state,
            "issued"
        );
    }

    #[test]
    fn unknown_objects_route_to_governed_generic_never_bypassed() {
        let decision = WorkflowRouter::new().route("settings_center", "mystery_object");
        assert_eq!(decision.object_kind, WorkflowObjectKind::Generic);
        assert!(decision.requires_human_approval);
        assert_eq!(decision.gate_chain.len(), 6);
        assert!(decision.blocks_on_unresolved);
    }

    #[test]
    fn template_id_is_module_scoped() {
        let decision = WorkflowRouter::new().route("detailed_design", "drawing_view");
        assert_eq!(decision.template_id, "detailed_design.drawing");
    }
}

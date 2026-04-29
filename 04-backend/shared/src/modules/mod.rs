//! Module registry · 11 模块注册表
//!
//! 架构决策 (2026-04-23 AIA):
//! - 所有模块并列 · 无 "业务 / 横向" 之分
//! - 加新模块:新建 struct + 实现 Module trait + 在 REGISTRY 注册
//! - 不改任何已有代码就能扩展
//! - 不用 Rust enum · 用 trait + `BTreeMap` runtime registry
//!
//! 详见 `02-architecture/MODULES.md` 与 `02-architecture/MODULE-REGISTRY.md`.

use std::collections::BTreeMap;
use std::sync::{Arc, OnceLock};

pub mod concept_design;
pub mod construction_supervision;
pub mod detailed_design;
pub mod digital_archive;
pub mod digital_twin;
pub mod marketing_service;
pub mod material_logistics;
pub mod production_manufacturing;
pub mod quantity_costing;
pub mod settings_center;
pub mod standard_library;

/// 模块 trait · 所有模块必须实现
pub trait Module: Send + Sync {
    fn id(&self) -> &'static str;
    fn zh_name(&self) -> &'static str;
    fn en_name(&self) -> &'static str;
    fn order(&self) -> u32;
    fn description(&self) -> &'static str;
    fn prompt_dir(&self) -> &'static str {
        self.id()
    }
    fn enabled(&self) -> bool {
        true
    }
}

/// 模块注册表
pub struct ModuleRegistry {
    modules: BTreeMap<&'static str, Arc<dyn Module>>,
}

impl ModuleRegistry {
    fn new() -> Self {
        Self {
            modules: BTreeMap::new(),
        }
    }

    pub fn register(&mut self, m: Arc<dyn Module>) {
        self.modules.insert(m.id(), m);
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn Module>> {
        self.modules.get(id).cloned()
    }

    pub fn list(&self) -> Vec<Arc<dyn Module>> {
        let mut v: Vec<_> = self.modules.values().cloned().collect();
        v.sort_by_key(|m| m.order());
        v
    }

    pub fn list_enabled(&self) -> Vec<Arc<dyn Module>> {
        self.list().into_iter().filter(|m| m.enabled()).collect()
    }

    pub fn ids(&self) -> Vec<&'static str> {
        self.list().iter().map(|m| m.id()).collect()
    }
}

static REGISTRY_STATIC: OnceLock<ModuleRegistry> = OnceLock::new();

/// 全局注册表访问器(运行时懒加载)
pub fn registry() -> &'static ModuleRegistry {
    REGISTRY_STATIC.get_or_init(|| {
        let mut r = ModuleRegistry::new();
        r.register(Arc::new(marketing_service::MarketingService));
        r.register(Arc::new(concept_design::ConceptDesign));
        r.register(Arc::new(standard_library::StandardLibrary));
        r.register(Arc::new(detailed_design::DetailedDesign));
        r.register(Arc::new(quantity_costing::QuantityCosting));
        r.register(Arc::new(material_logistics::MaterialLogistics));
        r.register(Arc::new(production_manufacturing::ProductionManufacturing));
        r.register(Arc::new(construction_supervision::ConstructionSupervision));
        r.register(Arc::new(digital_twin::DigitalTwin));
        r.register(Arc::new(digital_archive::DigitalArchive));
        r.register(Arc::new(settings_center::SettingsCenter));
        r
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_has_11_modules() {
        assert_eq!(registry().list().len(), 11);
    }

    #[test]
    fn modules_ordered_by_order_field() {
        let mods = registry().list();
        for i in 0..mods.len() - 1 {
            assert!(
                mods[i].order() < mods[i + 1].order(),
                "modules must be sorted by order · got {} before {}",
                mods[i].id(),
                mods[i + 1].id()
            );
        }
    }

    #[test]
    fn all_ids_match_convention() {
        for m in registry().list() {
            assert!(
                m.id()
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
                "id must be snake_case · {} violates",
                m.id()
            );
        }
    }

    #[test]
    fn production_manufacturing_is_the_active_factory_module() {
        assert!(registry().get("production_manufacturing").is_some());
        assert!(registry().get("manufacturing").is_none());
        assert!(registry().get("fabrication").is_none());
    }
}

use super::Module;

pub struct StandardLibrary;

impl Module for StandardLibrary {
    fn id(&self) -> &'static str {
        "standard_library"
    }
    fn zh_name(&self) -> &'static str {
        "标准族库"
    }
    fn en_name(&self) -> &'static str {
        "Standard Library"
    }
    fn order(&self) -> u32 {
        3
    }
    fn description(&self) -> &'static str {
        concat!(
            "InsomeOS 的\"构件 / 节点 / 材料 / 做法 / 规范条款\"标准库。\n",
            "被方案设计、深化设计、计量造价、加工制造、施工监理多个模块共同引用。\n",
            "支持族版本化、跨项目复用、与 GB/IBC/Eurocode 规范条款双向绑定。\n",
            "本身不消费任何上游输入,是全局共享资源。"
        )
    }
}

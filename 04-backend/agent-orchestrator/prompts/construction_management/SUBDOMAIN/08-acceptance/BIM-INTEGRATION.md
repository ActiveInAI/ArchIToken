# 08-acceptance · BIM-INTEGRATION

---

## 1. 竣工模型移交

`handover_certificate` 签发后 · 触发:
- detailed_design 里的 `bim_models.version` 升到 "as-built"
- 自动生成竣工模型的 IFC5 IFCX 版本(包括施工期的所有变更)
- 模型 URI + SHA-256 回写 certificate

## 2. 隐蔽工程 3D 锚定

`hidden_work.bim_element_guids` · 每项隐蔽锚到具体构件。

用途:
- 运维期 · 查某楼板隐蔽里埋了啥(管线 · 预埋件)
- 维修期 · 打凿前能看见原始隐蔽影像
- `<BIMViewer />` 上标绿标识"已隐蔽验收合格"

## 3. 验收记录的 3D 回放

一个竣工项目 · 按时序回放整个验收过程(旁站 + 隐蔽 + 分项 + 分部)· 形成"建筑成长史"视频。
用途:
- 审计 · 监管机构抽查
- 营销 · 给后续潜客看过程
- 培训 · 新监理的学习材料

## 4. 属性回写 IFC

`IfcPset_ArchIToken_AsBuilt`:
- `FinalVerdictDate`
- `HandoverCertNo`
- `ArchivePackageUri`

供未来孪生 / 运维永久查询。

---

version: 0.1.0 · 2026-04-23

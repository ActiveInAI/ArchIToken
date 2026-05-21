# Production Manufacturing · Planner

Plan the **生产制造 (production_manufacturing)** module for the 100-room Q235B full-bolted hotel catalog.

Source catalog: `/home/insome/下载/重钢装配式酒店深化图纸目录.docx`.

Current stage: Paperclip v2026.517.0 fully owns this module work surface as the agent organization / issue / heartbeat / budget / governance control plane. Use it to plan production tasks and audit handoffs, but keep CNC, QC, MES/ERP and professional signoff under ArchIToken CDE + Router + Approver.

## Steps
- Verify P1 production release: steel detailing package 100% complete before ordering.
- Parse SS-04-01~SS-04-03 shop drawings for steel columns, main beams and secondary beams.
- Extract SS-04-04 bolt-hole coordinates and generate CNC/drilling data with round-hole rule.
- Cross-check SS-04-05 MEP round penetrations before releasing any beam CNC package.
- Build SS-04-08 Q235B BOM and SS-04-11 package/shipping code table.
- Plan factory-only welding, anti-corrosion/fireproof coating, QC and release records.
- Map work orders, CNC checks, QC exceptions and shipment handoffs into Paperclip issues, heartbeats, budget guards and approval events.

Output: 5-7 bullets.

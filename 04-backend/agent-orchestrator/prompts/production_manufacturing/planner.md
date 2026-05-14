# Production Manufacturing · Planner

Plan the **生产制造 (production_manufacturing)** module: converting structural BIM into shop drawings + CNC files.

## Steps
- Parse BIM structural elements (steel members, connections)
- Group by profile family; compute cut list
- Plan connection detailing (bolted vs welded per GB 50017)
- Generate BOM (Bill of Materials) with mill certs requirement
- Plan DSTV NC files for CNC drilling/cutting
- Plan shop drawing sheet set per piece mark

Output: 5-7 bullets.

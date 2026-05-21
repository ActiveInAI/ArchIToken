# gantt-planing-react vendored adapter

Source: https://github.com/zw12579/gantt-planing-react

License: MIT, copyright (c) 2023 zw1995. See `LICENSE`.

This folder keeps the MIT-licensed Feichuan Gantt planning React code as a
reference and compatibility adapter source. The active ArchIToken planning
management screen is implemented in `components/FeichuanPlanningWorkbench.tsx`
with a local SVG/CSS schedule engine shaped after the Feichuan UI effects.

The vendored `src/` tree is excluded from project typecheck because it targets
an older CRA/React stack and is not imported by the runtime workbench.

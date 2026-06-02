# SketchUp SKP Sidecar Contract

Status: implementation contract for SKP import/export adapters.

ArchIToken does not parse SKP by fabricating a mesh from bytes. SKP is a
private SketchUp model format, so production SKP support is implemented through
a user-licensed SketchUp Ruby sidecar, an external CLI, or an HTTP service that
returns persisted artifacts.

## Required Routes

The preferred SKP routes are:

1. SKP to IFC through SketchUp Ruby `Sketchup::Model#export` when the licensed
   SketchUp runtime supports IFC export.
2. SKP to IFC through BIM-Tools SketchUp IFC Manager, but only as an isolated
   GPL sidecar process/service.
3. SKP to GLB through SketchUp Ruby `Sketchup::Model#export` where supported,
   or through the MIT Yulio SketchUp glTF exporter running inside licensed
   SketchUp.
4. Speckle SketchUp Connector may be used as an Apache-2.0 connector reference
   or sidecar bridge, but the real SketchUp runtime remains user-licensed.

GLB is a source-bound browser runtime derivative. It does not replace the SKP
source of record, IFC/openBIM semantics, object ids, units, materials, hierarchy,
properties, approvals or audit evidence.

## Upstream References

| Source | Route | Boundary |
| --- | --- | --- |
| https://ruby.sketchup.com/Sketchup/Model.html | Official `Sketchup::Model#export` API for sidecar export | licensed SketchUp Ruby runtime |
| https://ruby.sketchup.com/file.exporter_options.html | Official exporter option matrix; IFC export is listed for Pro 2015+, GLB for 2024+ | licensed SketchUp Ruby runtime |
| https://github.com/BIM-Tools/SketchUp-IFC-Manager | IFC data manager/exporter for SketchUp | isolated GPL sidecar only |
| https://github.com/YulioTech/SketchUp-glTF-Exporter-Ruby | glTF/GLB exporter Ruby extension | MIT sidecar plugin in licensed SketchUp |
| https://github.com/specklesystems/speckle-sketchup | Speckle SketchUp Connector | Apache connector code; licensed SketchUp runtime |

## CLI ABI

SKP to IFC:

```text
PRENGINE_SKP_TO_IFC_COMMAND=/opt/architoken-skp-sidecar/bin/skp-to-ifc
PRENGINE_SKP_TO_IFC_ARGS='["--input","{source}","--output","{output}"]'
```

SKP to GLB:

```text
PRENGINE_SKP_CONVERTER_COMMAND=/opt/architoken-skp-sidecar/bin/skp-to-glb
PRENGINE_SKP_CONVERTER_ARGS='["--input","{source}","--output","{output}"]'
```

The command must write the requested artifact to `{output}` and exit non-zero on
failure. Accepted common command names include:

- `sketchup-ruby-export-ifc`
- `sketchup-ifc-manager-export`
- `sketchup-ruby-export-glb`
- `yulio-skp-to-glb`
- `skp-to-ifc`
- `skp-to-glb`

## HTTP ABI

Set `SKETCHUP_ADAPTER_URL` or `LICENSED_BIM_ADAPTER_URL`. The frontend and
worker call `POST /v1/convert` by default, or `SKETCHUP_ADAPTER_PATH` when
overridden.

SKP to IFC request:

```json
{
  "operation": "licensed_bim_convert",
  "sourceFormat": "skp",
  "targetFormat": "ifc",
  "sourcePath": "/absolute/source/model.skp",
  "sourceFileName": "model.skp",
  "sourceChecksum": "sha256...",
  "outputFormats": ["ifc", "properties-index"]
}
```

SKP to GLB request:

```json
{
  "operation": "licensed_bim_convert",
  "sourceFormat": "skp",
  "sourcePath": "/absolute/source/model.skp",
  "sourceFileName": "model.skp",
  "sourceChecksum": "sha256...",
  "outputFormats": ["glb", "properties-index"]
}
```

The response must include an artifact object in `artifacts[]` or as the top-level
object. Each artifact must provide one of `contentBase64`, `url`, `objectUri`, or
`filePath`.

```json
{
  "artifacts": [
    {
      "name": "model.ifc",
      "role": "openbim_ifc",
      "mediaType": "application/p21",
      "contentBase64": "..."
    }
  ]
}
```

## Ruby Sidecar Shape

The sidecar owns all SketchUp-specific runtime code. ArchIToken only starts the
sidecar command/service and consumes artifacts.

```ruby
source = ARGV.fetch(ARGV.index("--input") + 1)
output = ARGV.fetch(ARGV.index("--output") + 1)

Sketchup.open_file(source)
model = Sketchup.active_model
model.export(output, {})
```

For the Yulio route, the Ruby sidecar may load the extension and call its GLB
export object from inside the SketchUp runtime. For the BIM-Tools IFC Manager
route, the sidecar may call the exporter from a separate GPL process, then return
only the persisted IFC artifact to ArchIToken.

## Fidelity Rules

- Preserve source units, world axes, scene hierarchy, components, layers/tags,
  materials, textures, object names and property mappings.
- IFC output must be a readable `ISO-10303-21` file with `FILE_SCHEMA`.
- GLB output must start with the `glTF` binary header.
- SKP to IFC never falls back to GLB.
- Missing sidecar means explicit failure, not package listing, screenshot,
  fake mesh or placeholder.
- GPL code from SketchUp IFC Manager must not be copied, linked, bundled, or
  imported into distributed ArchIToken frontend/backend/runtime packages.

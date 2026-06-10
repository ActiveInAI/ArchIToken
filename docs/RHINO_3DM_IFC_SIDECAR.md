# Rhino 3DM IFC Sidecar Contract

**Status**: production boundary contract
**Scope**: Rhino `.3dm` source files to audited IFC derivatives

ArchIToken treats `.3dm` as a source format. The platform may inspect source bytes through rhino3dm/OpenNURBS, but IFC/openBIM delivery must be a real derivative produced by an adapter that can read the 3DM source and export ISO-10303-21 IFC.

The frontend, gateway and workers must not synthesize IFC from Rhino display meshes, browser Three.js objects, screenshots, package listings or placeholder manifests. If no adapter is configured, the correct result is an explicit `adapter_required` / `adapter_not_configured` state.

## Command ABI

Preferred command variables:

```bash
PANAEC_3DM_TO_IFC_COMMAND=/opt/architoken-rhino-sidecar/bin/3dm-to-ifc
PANAEC_3DM_TO_IFC_ARGS='["--input","{source}","--output","{output}"]'
```

Local development profile:

```bash
PANAEC_3DM_TO_IFC_COMMAND=/home/insome/dev/insomeos/06-workers/scripts/panaec-3dm-to-ifc
```

The local command uses `rhino3dm`/OpenNURBS to read 3DM source geometry and
IfcOpenShell to write IFC4 tessellated geometry. It is a real ISO-10303-21 IFC
artifact route, but it does not claim Rhino/Speckle professional object typing
or project-specific BIM classification.

Accepted command aliases:

```bash
RHINO_3DM_TO_IFC_COMMAND
THREEDM_TO_IFC_COMMAND
RHINO_TO_IFC_COMMAND
THREEDM2IFC_BIN
THREEDM_TO_IFC_BIN
RHINO_TO_IFC_BIN
RHINO_COMPUTE_EXPORT_IFC_BIN
```

Argument placeholders:

| Placeholder | Meaning |
| --- | --- |
| `{source}` / `{input}` | Local 3DM source path |
| `{output}` | Output IFC path the sidecar must create |
| `{fileId}` | ArchIToken local file id |
| `{fileName}` | Original source file name |
| `{checksum}` | Source SHA-256 checksum where available |

The command must exit `0` and write a readable IFC file containing `ISO-10303-21` and `FILE_SCHEMA`. Anything else is a failed conversion, not a preview.

## HTTP ABI

Set one of:

```bash
RHINO_ADAPTER_URL=http://rhino-sidecar:8080
SPECKLE_RHINO_ADAPTER_URL=http://speckle-rhino-sidecar:8080
LICENSED_BIM_ADAPTER_URL=http://licensed-bim-adapter:8080
RHINO_ADAPTER_PATH=/v1/convert
```

The frontend and worker POST a JSON payload:

```json
{
  "operation": "licensed_bim_convert",
  "sourceFormat": "3dm",
  "targetFormat": "ifc",
  "outputFormats": ["ifc", "properties-index"],
  "sourcePath": "/mounted/uploads/source.3dm"
}
```

The service must return an IFC artifact through `contentBase64`, `url` / `objectUri`, or `filePath`. Returned bytes are validated before being cached.

## Adapter Boundary

Allowed implementation families:

- Rhino / Rhino Compute sidecar with user-authorized runtime.
- Speckle IFC Exporter Rhino sidecar.
- OpenNURBS-capable enterprise service that emits real IFC.
- A project-provided command or service that preserves source id, layer, object attributes and coordinate policy in the emitted IFC or sidecar manifest.

The open rhino3dm/OpenNURBS reader is useful for source inspection and metadata extraction. It does not by itself make an IFC export compliant or production-ready.

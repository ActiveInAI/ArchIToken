// lib/file-type-registry.ts - Unified file type runtime registry
// License: Apache-2.0

export type FileViewerKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'json'
  | 'csv'
  | 'office'
  | 'engineering'
  | 'archive'
  | 'unknown';

export type FileProcessingStage =
  | 'store'
  | 'preview'
  | 'extract'
  | 'parse'
  | 'convert'
  | 'validate'
  | 'runtime';

export type FileProcessingMode =
  | 'native'
  | 'browser'
  | 'worker'
  | 'service'
  | 'external_process'
  | 'licensed_adapter'
  | 'not_applicable';

export type FileStageStatus =
  | 'ready'
  | 'adapter_required'
  | 'external_process_required'
  | 'licensed_adapter_required'
  | 'not_applicable';

export type FileProductionRoute =
  | 'ready'
  | 'adapter_required'
  | 'external_process_required'
  | 'licensed_adapter_required';

export interface FileStageRoute {
  mode: FileProcessingMode;
  status: FileStageStatus;
  adapter: string;
}

export type FileStagePolicy = Record<FileProcessingStage, FileStageRoute>;

export interface FileTypeRegistryEntry {
  id: string;
  logicalType: string;
  label: string;
  extensions: readonly string[];
  exactNames?: readonly string[];
  suffixNames?: readonly string[];
  mimeType: string;
  viewerKind: FileViewerKind;
  adapters: readonly string[];
  stages: FileStagePolicy;
  productionRoute: FileProductionRoute;
}

export interface LogicalFileTypeRegistryEntry {
  id: string;
  supportedByDefault: boolean;
  backingFileTypeIds: readonly string[];
  stages: FileStagePolicy;
  productionRoute: FileProductionRoute;
}

export const fileProcessingStages = [
  'store',
  'preview',
  'extract',
  'parse',
  'convert',
  'validate',
  'runtime',
] as const satisfies readonly FileProcessingStage[];

export const requestedFileTypeExtensions = [
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.csv',
  '.tsv',
  '.ifc',
  '.ifczip',
  '.bcfzip',
  '.rvt',
  '.rfa',
  '.dwg',
  '.dxf',
  '.dgn',
  '.nwd',
  '.nwf',
  '.nwc',
  '.skp',
  '.3dm',
  '.3dxml',
  '.sldprt',
  '.sldasm',
  '.slddrw',
  '.catpart',
  '.catproduct',
  '.catdrawing',
  '.step',
  '.stp',
  '.iges',
  '.igs',
  '.sat',
  '.x_t',
  '.x_b',
  '.obj',
  '.fbx',
  '.dae',
  '.stl',
  '.stel',
  '.ply',
  '.gltf',
  '.glb',
  '.usd',
  '.usdz',
  '.las',
  '.laz',
  '.e57',
  '.pts',
  '.ptx',
  '.xyz',
  '.pcd',
  '.tif',
  '.tiff',
  '.geotiff',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.mp3',
  '.wav',
  '.m4a',
  '.flac',
  '.mp4',
  '.mkv',
  '.mov',
  '.avi',
  '.webm',
  '.mpp',
  '.vsdx',
  '.drawio',
  '.mmd',
  '.puml',
  '.xmind',
  '.dng',
  '.raw',
  '.kml',
  '.kmz',
  '.shp',
  '.shx',
  '.dbf',
  '.prj',
  '.geojson',
  '.gpkg',
  '.dem',
  '.asc',
  '.bil',
  '.b3dm',
  '.i3dm',
  '.pnts',
  '.cmpt',
  '.bag',
  '.db3',
  '.mcap',
  '.urdf',
  '.xacro',
  '.sdf',
  '.world',
  '.srdf',
  '.gcode',
  '.nc',
  '.nc1',
  '.cnc',
  '.tap',
  '.xml',
  '.html',
  '.htm',
  '.json',
  '.jsonl',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.cfg',
  '.env',
  '.log',
  '.lock',
  '.rtf',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.rb',
  '.php',
  '.kt',
  '.cs',
  '.cpp',
  '.cxx',
  '.cc',
  '.c',
  '.h',
  '.hpp',
  '.hh',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.bat',
  '.cmd',
  '.ps1',
  '.pl',
  '.sql',
  '.graphql',
  '.proto',
  '.protobuf',
  '.rego',
  '.md',
  '.rst',
  '.adoc',
  '.jsonc',
  '.bson',
  '.msgpack',
  '.mpack',
  '.avro',
  '.dll',
  '.class',
  '.exe',
  '.so',
] as const;

export const requestedExactFileTypeNames = [
  'Dockerfile',
  'docker-compose.yml',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'Cargo.toml',
  'Cargo.lock',
  'pyproject.toml',
  'go.mod',
  'go.sum',
  'Makefile',
  '.env',
  '.env.local',
  '.gitignore',
  '.dockerignore',
  '.openapi.yaml',
  'openapi.json',
] as const;

export const requestedLogicalFileTypes = [
  'office.document',
  'office.spreadsheet',
  'office.presentation',
  'office.email',
  'office.database',
  'office.project',
  'office.diagram',
  'pdf.document',
  'pdf.archive',
  'pdf.engineering',
  'pdf.print',
  'pdf.accessibility',
  'pdf.form',
  'code.source',
  'code.config',
  'code.schema',
  'code.package',
  'code.infra',
  'code.notebook',
  'aec.bim.ifc',
  'aec.bim.bcf',
  'aec.bim.cobie',
  'aec.bim.gbxml',
  'aec.bim.ids',
  'aec.gis',
  'aec.citymodel',
  'aec.schedule',
  'aec.cost',
  'cad.2d',
  'cad.3d',
  'cad.mechanical',
  'cad.fabrication',
  'cad.exchange',
  'cad.print',
  'vendor.revit',
  'vendor.navisworks',
  'vendor.autocad',
  'vendor.rhino',
  'vendor.grasshopper',
  'vendor.tekla',
  'vendor.sketchup',
  'vendor.solidworks',
  'vendor.catia',
  'vendor.bentley',
  'vendor.lumion',
  'vendor.blender',
  'vendor.max',
  'vendor.maya',
  'scan.pointcloud',
  'scan.mesh',
  'scan.photogrammetry',
  'scan.realitycapture',
  'uav.raw',
  'uav.video',
  'uav.log',
  'uav.mapping',
  'xr.model',
  'xr.runtime',
  'xr.anchor',
  'robot.description',
  'robot.log',
  'robot.path',
  'robot.cnc',
  'robot.plc',
  'robot.telemetry',
  'diagram.flowchart',
  'diagram.gantt',
  'diagram.mindmap',
  'diagram.architecture',
  'diagram.uml',
  'diagram.bpmn',
  'media.image',
  'media.audio',
  'media.video',
  'media.sequence',
  'media.texture',
] as const;

const browserView = policy({
  preview: route('browser', 'ready', 'browser native viewer'),
  extract: route('worker', 'adapter_required', 'extract worker'),
  parse: route('worker', 'adapter_required', 'parser worker'),
  convert: route('worker', 'adapter_required', 'conversion worker'),
  validate: route('worker', 'adapter_required', 'validation worker'),
  runtime: route('worker', 'adapter_required', 'runtime adapter'),
});

const textConfig = policy({
  preview: route('browser', 'ready', 'text viewer'),
  extract: route('native', 'ready', 'UTF-8 text reader'),
  parse: route('native', 'ready', 'structured text parser'),
  convert: route('worker', 'adapter_required', 'document conversion worker'),
  validate: route('native', 'ready', 'schema/lint validator'),
  runtime: route('native', 'ready', 'code/config runtime registry'),
});

const officeWorker = policy({
  preview: route('worker', 'adapter_required', 'Backend native Office runtime'),
  extract: route('worker', 'adapter_required', 'MarkItDown/Office extractor'),
  parse: route('worker', 'adapter_required', 'Office Open XML parser'),
  convert: route(
    'worker',
    'adapter_required',
    'Explicit Office export worker',
  ),
  validate: route('worker', 'adapter_required', 'document schema validator'),
  runtime: route('service', 'adapter_required', 'Office editing service'),
});

const openBimWorker = policy({
  preview: route('worker', 'adapter_required', 'IfcOpenShell/BCF worker'),
  extract: route('worker', 'adapter_required', 'openBIM extractor'),
  parse: route('worker', 'adapter_required', 'buildingSMART parser'),
  convert: route('worker', 'adapter_required', 'IFC/BCF derivative worker'),
  validate: route('worker', 'adapter_required', 'buildingSMART validator'),
  runtime: route('worker', 'adapter_required', 'openBIM runtime adapter'),
});

const browserEngineering = policy({
  preview: route('browser', 'ready', 'Three.js/BIMViewer'),
  extract: route('worker', 'adapter_required', 'geometry extractor'),
  parse: route('worker', 'adapter_required', 'geometry parser'),
  convert: route('worker', 'adapter_required', 'geometry conversion worker'),
  validate: route('worker', 'adapter_required', 'geometry validator'),
  runtime: route('worker', 'adapter_required', '3D runtime adapter'),
});

const cadKernelWorker = policy({
  preview: route('worker', 'adapter_required', 'OCCT/OCP derivative worker'),
  extract: route('worker', 'adapter_required', 'OCCT/OCP extractor'),
  parse: route('worker', 'adapter_required', 'OCCT/OCP parser'),
  convert: route('worker', 'adapter_required', 'OCCT/CadQuery converter'),
  validate: route('worker', 'adapter_required', 'CAD kernel validator'),
  runtime: route('worker', 'adapter_required', 'CAD kernel runtime'),
});

const dxfNativeDrawing = policy({
  preview: route('browser', 'ready', 'Browser DXF Canvas entity viewer'),
  extract: route('worker', 'adapter_required', 'ezdxf entity extractor'),
  parse: route('browser', 'ready', 'dxf-parser entity parser'),
  convert: route('worker', 'adapter_required', 'DXF CAD conversion worker'),
  validate: route('worker', 'adapter_required', 'DXF drawing validator'),
  runtime: route('browser', 'ready', 'native DXF drawing runtime'),
});

const licensedVendor = policy({
  preview: route(
    'licensed_adapter',
    'licensed_adapter_required',
    'licensed vendor adapter',
  ),
  extract: route(
    'licensed_adapter',
    'licensed_adapter_required',
    'licensed vendor extractor',
  ),
  parse: route(
    'licensed_adapter',
    'licensed_adapter_required',
    'licensed vendor parser',
  ),
  convert: route(
    'licensed_adapter',
    'licensed_adapter_required',
    'licensed vendor converter',
  ),
  validate: route(
    'licensed_adapter',
    'licensed_adapter_required',
    'licensed vendor validator',
  ),
  runtime: route(
    'licensed_adapter',
    'licensed_adapter_required',
    'licensed vendor runtime',
  ),
});

const externalProcess = policy({
  preview: route(
    'external_process',
    'external_process_required',
    'external process adapter',
  ),
  extract: route(
    'external_process',
    'external_process_required',
    'external process extractor',
  ),
  parse: route(
    'external_process',
    'external_process_required',
    'external process parser',
  ),
  convert: route(
    'external_process',
    'external_process_required',
    'external process converter',
  ),
  validate: route(
    'external_process',
    'external_process_required',
    'external process validator',
  ),
  runtime: route(
    'external_process',
    'external_process_required',
    'external process runtime',
  ),
});

const archiveNativePreview = policy({
  preview: route('native', 'ready', 'ZIP central directory reader'),
  extract: route(
    'external_process',
    'external_process_required',
    'PeaZip/NanaZip-compatible archive scanner/extractor',
  ),
  parse: route(
    'external_process',
    'external_process_required',
    'archive manifest parser with unsafe-path and nested-package checks',
  ),
  convert: route(
    'external_process',
    'external_process_required',
    'archive repack worker',
  ),
  validate: route(
    'external_process',
    'external_process_required',
    'archive hash/virus scanner',
  ),
  runtime: route(
    'external_process',
    'external_process_required',
    'archive retention runtime',
  ),
});

const gisWorker = policy({
  preview: route('worker', 'adapter_required', 'MapLibre/Cesium/GDAL preview'),
  extract: route('worker', 'adapter_required', 'GDAL/OGR extractor'),
  parse: route('worker', 'adapter_required', 'GDAL/OGR parser'),
  convert: route('worker', 'adapter_required', 'GIS tile/COG converter'),
  validate: route('worker', 'adapter_required', 'geospatial validator'),
  runtime: route('worker', 'adapter_required', 'GIS runtime adapter'),
});

const diagramWorker = policy({
  preview: route('browser', 'ready', 'Mermaid/PlantUML/AntV viewer'),
  extract: route('worker', 'adapter_required', 'diagram extractor'),
  parse: route('worker', 'adapter_required', 'diagram parser'),
  convert: route('worker', 'adapter_required', 'SVG/PDF diagram exporter'),
  validate: route('worker', 'adapter_required', 'diagram validator'),
  runtime: route('service', 'adapter_required', 'diagram editing runtime'),
});

const pointCloudWorker = policy({
  preview: route('worker', 'adapter_required', 'Potree/3D Tiles derivative'),
  extract: route('worker', 'adapter_required', 'PDAL extractor'),
  parse: route('worker', 'adapter_required', 'PDAL parser'),
  convert: route('worker', 'adapter_required', 'EPT/3D Tiles converter'),
  validate: route('worker', 'adapter_required', 'point-cloud validator'),
  runtime: route('worker', 'adapter_required', 'reality runtime adapter'),
});

export const fileTypeRegistry = [
  fileType('pdf-document', 'pdf.document', 'PDF document', ['.pdf'], {
    mimeType: 'application/pdf',
    viewerKind: 'pdf',
    adapters: ['browser PDF viewer', 'Stirling PDF', 'PDFium/MuPDF'],
    stages: browserView,
    productionRoute: 'ready',
  }),
  fileType(
    'office-document',
    'office.document',
    'Office document',
    ['.docx', '.doc', '.odt'],
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      viewerKind: 'office',
      adapters: ['LibreOffice headless', 'MarkItDown', 'Univer Docs'],
      stages: officeWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'office-spreadsheet',
    'office.spreadsheet',
    'Office spreadsheet',
    ['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods'],
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      viewerKind: 'office',
      adapters: ['LibreOffice headless', 'Excelize', 'Univer Sheets'],
      stages: officeWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'office-presentation',
    'office.presentation',
    'Office presentation',
    ['.pptx', '.ppt', '.odp'],
    {
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      viewerKind: 'office',
      adapters: ['LibreOffice headless', 'MarkItDown', 'Univer Slides'],
      stages: officeWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType('office-email', 'office.email', 'Office email', ['.eml', '.msg'], {
    mimeType: 'message/rfc822',
    viewerKind: 'text',
    adapters: ['mail parser worker', 'MarkItDown'],
    stages: officeWorker,
    productionRoute: 'adapter_required',
  }),
  fileType(
    'office-database',
    'office.database',
    'Office database',
    ['.mdb', '.accdb', '.sqlite', '.db'],
    {
      mimeType: 'application/vnd.ms-access',
      viewerKind: 'text',
      adapters: ['database import worker'],
      stages: externalProcess,
      productionRoute: 'external_process_required',
    },
  ),
  fileType(
    'office-project',
    'office.project',
    'Office project schedule',
    ['.mpp'],
    {
      mimeType: 'application/vnd.ms-project',
      viewerKind: 'office',
      adapters: ['project schedule worker'],
      stages: officeWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'office-diagram',
    'office.diagram',
    'Office diagram',
    ['.vsdx', '.drawio'],
    {
      mimeType: 'application/vnd.visio',
      viewerKind: 'engineering',
      adapters: ['diagram conversion worker', 'AntV X6/G6'],
      stages: diagramWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'tabular-text',
    'office.spreadsheet',
    'CSV/TSV table',
    ['.csv', '.tsv'],
    {
      mimeType: 'text/csv',
      viewerKind: 'csv',
      adapters: ['native table reader', 'Univer Sheets import worker'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType('openbim-ifc', 'aec.bim.ifc', 'IFC openBIM', ['.ifc', '.ifczip'], {
    mimeType: 'application/x-step',
    viewerKind: 'engineering',
    adapters: ['IfcOpenShell', 'buildingSMART validate'],
    stages: openBimWorker,
    productionRoute: 'adapter_required',
  }),
  fileType(
    'openbim-bcf',
    'aec.bim.bcf',
    'BCF issue package',
    ['.bcf', '.bcfzip'],
    {
      mimeType: 'application/x-bcfzip',
      viewerKind: 'engineering',
      adapters: ['buildingSMART BCF API/XML parser'],
      stages: openBimWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType('openbim-ids', 'aec.bim.ids', 'IDS validation rule', ['.ids'], {
    mimeType: 'application/xml',
    viewerKind: 'text',
    adapters: ['buildingSMART IDS Audit tool'],
    stages: openBimWorker,
    productionRoute: 'adapter_required',
  }),
  fileType('openbim-idm', 'aec.bim.idm', 'IDM exchange requirement', ['.idm'], {
    mimeType: 'application/json',
    viewerKind: 'text',
    adapters: ['buildingSMART IDM worker', 'IDS/bSDD/BCF mapper'],
    stages: openBimWorker,
    productionRoute: 'adapter_required',
  }),
  fileType('openbim-gbxml', 'aec.bim.gbxml', 'gbXML model', ['.gbxml'], {
    mimeType: 'application/xml',
    viewerKind: 'text',
    adapters: ['gbXML parser worker'],
    stages: openBimWorker,
    productionRoute: 'adapter_required',
  }),
  fileType('vendor-3dxml', 'cad.exchange', '3D XML model', ['.3dxml'], {
    mimeType: 'model/vnd.3dxml',
    viewerKind: 'engineering',
    adapters: ['3D XML adapter', 'OCCT/Dassault-compatible sidecar'],
    stages: cadKernelWorker,
    productionRoute: 'adapter_required',
  }),
  fileType('openbim-cobie', 'aec.bim.cobie', 'COBie exchange', ['.cobie'], {
    mimeType: 'text/csv',
    viewerKind: 'csv',
    adapters: ['COBie validation worker', 'Excelize'],
    stages: officeWorker,
    productionRoute: 'adapter_required',
  }),
  fileType('vendor-revit', 'vendor.revit', 'Autodesk Revit', ['.rvt', '.rfa'], {
    mimeType: 'application/vnd.autodesk.revit',
    viewerKind: 'engineering',
    adapters: ['Autodesk APS/Revit adapter', 'Revit MCP bridge'],
    stages: licensedVendor,
    productionRoute: 'licensed_adapter_required',
  }),
  fileType(
    'cad-dxf-drawing',
    'cad.2d',
    'DXF drawing',
    ['.dxf'],
    {
      mimeType: 'application/dxf',
      viewerKind: 'engineering',
      adapters: ['browser DXF Canvas viewer', 'dxf-parser', 'ezdxf'],
      stages: dxfNativeDrawing,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'vendor-autocad',
    'vendor.autocad',
    'AutoCAD DWG drawing',
    ['.dwg'],
    {
      mimeType: 'application/acad',
      viewerKind: 'engineering',
      adapters: [
        'DDC/ODA DWG vector PDF exporter',
        'Autodesk APS/AutoCAD adapter',
        'licensed DWG adapter',
        'LibreDWG/ODAFileConverter DXF derivative',
      ],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType('vendor-bentley', 'vendor.bentley', 'Bentley DGN', ['.dgn'], {
    mimeType: 'application/vnd.bentley.dgn',
    viewerKind: 'engineering',
    adapters: ['Bentley/iTwin adapter'],
    stages: licensedVendor,
    productionRoute: 'licensed_adapter_required',
  }),
  fileType(
    'vendor-navisworks',
    'vendor.navisworks',
    'Navisworks package',
    ['.nwd', '.nwf', '.nwc'],
    {
      mimeType: 'application/vnd.autodesk.navisworks',
      viewerKind: 'engineering',
      adapters: ['Autodesk/Navisworks adapter'],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType('vendor-sketchup', 'vendor.sketchup', 'SketchUp model', ['.skp'], {
    mimeType: 'model/vnd.sketchup.skp',
    viewerKind: 'engineering',
    adapters: ['SketchUp/Speckle adapter'],
    stages: licensedVendor,
    productionRoute: 'licensed_adapter_required',
  }),
  fileType('vendor-rhino', 'vendor.rhino', 'Rhino model', ['.3dm'], {
    mimeType: 'model/vnd.3dm',
    viewerKind: 'engineering',
    adapters: ['Rhino Compute', 'Speckle Rhino adapter'],
    stages: licensedVendor,
    productionRoute: 'licensed_adapter_required',
  }),
  fileType(
    'vendor-grasshopper',
    'vendor.grasshopper',
    'Grasshopper definition',
    ['.gh', '.ghx'],
    {
      mimeType: 'application/vnd.grasshopper',
      viewerKind: 'engineering',
      adapters: ['Rhino/Grasshopper adapter'],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType(
    'vendor-tekla',
    'vendor.tekla',
    'Tekla/fabrication model',
    ['.tekla'],
    {
      mimeType: 'application/vnd.tekla',
      viewerKind: 'engineering',
      adapters: ['Tekla Structures Open API adapter'],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType(
    'vendor-solidworks',
    'vendor.solidworks',
    'SolidWorks model',
    ['.sldprt', '.sldasm', '.slddrw'],
    {
      mimeType: 'application/vnd.solidworks',
      viewerKind: 'engineering',
      adapters: ['SolidWorks licensed adapter'],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType(
    'vendor-catia',
    'vendor.catia',
    'CATIA model',
    ['.catpart', '.catproduct', '.catdrawing'],
    {
      mimeType: 'application/vnd.catia',
      viewerKind: 'engineering',
      adapters: ['CATIA licensed adapter'],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType('vendor-blender', 'vendor.blender', 'Blender scene', ['.blend'], {
    mimeType: 'application/x-blender',
    viewerKind: 'engineering',
    adapters: ['Blender external process', 'Blender MCP'],
    stages: externalProcess,
    productionRoute: 'external_process_required',
  }),
  fileType('vendor-max', 'vendor.max', '3ds Max scene', ['.max'], {
    mimeType: 'application/vnd.autodesk.3dsmax',
    viewerKind: 'engineering',
    adapters: ['3ds Max licensed adapter'],
    stages: licensedVendor,
    productionRoute: 'licensed_adapter_required',
  }),
  fileType('vendor-maya', 'vendor.maya', 'Maya scene', ['.ma', '.mb'], {
    mimeType: 'application/vnd.autodesk.maya',
    viewerKind: 'engineering',
    adapters: ['Maya licensed adapter'],
    stages: licensedVendor,
    productionRoute: 'licensed_adapter_required',
  }),
  fileType(
    'cad-exchange',
    'cad.exchange',
    'CAD exchange geometry',
    ['.step', '.stp', '.iges', '.igs', '.sat', '.x_t', '.x_b', '.brep'],
    {
      mimeType: 'model/step',
      viewerKind: 'engineering',
      adapters: ['OCCT/OCP worker', 'CadQuery'],
      stages: cadKernelWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'cad-stel-unverified',
    'cad.exchange',
    'STEL source adapter boundary',
    ['.stel'],
    {
      mimeType: 'application/octet-stream',
      viewerKind: 'engineering',
      adapters: ['licensed enterprise STEL adapter'],
      stages: licensedVendor,
      productionRoute: 'licensed_adapter_required',
    },
  ),
  fileType(
    'cad-mesh',
    'scan.mesh',
    'Mesh geometry',
    ['.obj', '.fbx', '.dae', '.stl', '.ply'],
    {
      mimeType: 'model/obj',
      viewerKind: 'engineering',
      adapters: ['Three.js viewer', 'Blender/mesh worker'],
      stages: browserEngineering,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'xr-model',
    'xr.model',
    'XR/glTF/USD model',
    ['.gltf', '.glb', '.usd', '.usdz'],
    {
      mimeType: 'model/gltf-binary',
      viewerKind: 'engineering',
      adapters: ['Three.js viewer', 'USD conversion worker'],
      stages: browserEngineering,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'scan-pointcloud',
    'scan.pointcloud',
    'Point cloud scan',
    ['.las', '.laz', '.e57', '.pts', '.ptx', '.xyz', '.pcd'],
    {
      mimeType: 'application/octet-stream',
      viewerKind: 'engineering',
      adapters: ['PDAL', 'Potree/EPT', '3D Tiles worker'],
      stages: pointCloudWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'media-image',
    'media.image',
    'Image asset',
    ['.tif', '.tiff', '.geotiff', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'],
    {
      mimeType: 'image/png',
      viewerKind: 'image',
      adapters: ['browser image viewer', 'PaddleOCR'],
      stages: browserView,
      productionRoute: 'ready',
    },
  ),
  fileType('uav-raw', 'uav.raw', 'UAV/raw image', ['.dng', '.raw'], {
    mimeType: 'image/x-adobe-dng',
    viewerKind: 'image',
    adapters: ['raw image decoder worker', 'photogrammetry worker'],
    stages: pointCloudWorker,
    productionRoute: 'adapter_required',
  }),
  fileType(
    'media-video',
    'media.video',
    'Video asset',
    ['.mp4', '.mov', '.webm', '.mkv', '.avi'],
    {
      mimeType: 'video/mp4',
      viewerKind: 'video',
      adapters: ['browser video viewer', 'FFmpeg/transcode worker'],
      stages: browserView,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'media-audio',
    'media.audio',
    'Audio asset',
    ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'],
    {
      mimeType: 'audio/mpeg',
      viewerKind: 'audio',
      adapters: ['browser audio viewer', 'ASR/TTS provider'],
      stages: browserView,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'aec-gis-vector',
    'aec.gis',
    'GIS vector data',
    ['.kml', '.kmz', '.shp', '.shx', '.dbf', '.prj', '.geojson', '.gpkg'],
    {
      mimeType: 'application/geo+json',
      viewerKind: 'json',
      adapters: ['GDAL/OGR', 'MapLibre/Cesium'],
      stages: gisWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'aec-gis-raster',
    'aec.gis',
    'GIS raster/elevation',
    ['.dem', '.asc', '.bil'],
    {
      mimeType: 'application/octet-stream',
      viewerKind: 'engineering',
      adapters: ['GDAL raster worker', 'terrain tile worker'],
      stages: gisWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'aec-citymodel',
    'aec.citymodel',
    '3D Tiles city model',
    ['.b3dm', '.i3dm', '.pnts', '.cmpt'],
    {
      mimeType: 'model/vnd.3dtiles',
      viewerKind: 'engineering',
      adapters: ['Cesium 3D Tiles runtime', 'tileset validator'],
      stages: browserEngineering,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'robot-log',
    'robot.log',
    'Robot/runtime log',
    ['.bag', '.db3', '.mcap'],
    {
      mimeType: 'application/octet-stream',
      viewerKind: 'archive',
      adapters: ['ROS bag/MCAP parser worker'],
      stages: externalProcess,
      productionRoute: 'external_process_required',
    },
  ),
  fileType(
    'robot-description',
    'robot.description',
    'Robot description',
    ['.urdf', '.xacro', '.sdf', '.world', '.srdf'],
    {
      mimeType: 'application/xml',
      viewerKind: 'text',
      adapters: ['ROS/URDF parser worker'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'robot-cnc',
    'robot.cnc',
    'CNC/G-code program',
    ['.gcode', '.nc', '.nc1', '.cnc', '.tap'],
    {
      mimeType: 'text/plain',
      viewerKind: 'text',
      adapters: ['G-code parser worker', 'CNC release validator'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'diagram-text',
    'diagram.flowchart',
    'Text diagram',
    ['.mmd', '.mermaid', '.puml', '.xmind'],
    {
      mimeType: 'text/plain',
      viewerKind: 'text',
      adapters: ['Mermaid renderer', 'PlantUML worker', 'AntV G6/X6'],
      stages: diagramWorker,
      productionRoute: 'adapter_required',
    },
  ),
  fileType(
    'code-source',
    'code.source',
    'Source code',
    [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.rs',
      '.go',
      '.java',
      '.kt',
      '.cs',
      '.cpp',
      '.cxx',
      '.cc',
      '.c',
      '.h',
      '.hpp',
      '.hh',
      '.rb',
      '.php',
      '.pl',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.bat',
      '.cmd',
      '.ps1',
      '.html',
      '.htm',
      '.css',
      '.scss',
      '.sass',
      '.less',
    ],
    {
      mimeType: 'text/plain',
      viewerKind: 'text',
      adapters: ['native source viewer', 'language parser/linter'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'code-schema',
    'code.schema',
    'Schema/API definition',
    ['.sql', '.graphql', '.proto', '.protobuf', '.rego'],
    {
      mimeType: 'text/plain',
      viewerKind: 'text',
      adapters: ['schema parser/linter', 'OpenAPI/GraphQL/Proto validator'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'markdown-doc',
    'code.config',
    'Markdown/reStructuredText/AsciiDoc',
    ['.md', '.markdown', '.rst', '.adoc', '.rtf'],
    {
      mimeType: 'text/markdown',
      viewerKind: 'text',
      adapters: ['markdown viewer', 'documentation parser'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType(
    'structured-config',
    'code.config',
    'Structured config',
    [
      '.xml',
      '.json',
      '.jsonc',
      '.jsonl',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.conf',
      '.cfg',
      '.env',
      '.log',
      '.lock',
      '.bson',
      '.msgpack',
      '.mpack',
      '.avro',
    ],
    {
      mimeType: 'application/json',
      viewerKind: 'json',
      adapters: ['native config parser', 'schema validator'],
      stages: textConfig,
      productionRoute: 'ready',
    },
  ),
  fileType('code-package', 'code.package', 'Package manifest', [], {
    exactNames: [
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lock',
      'Cargo.toml',
      'Cargo.lock',
      'pyproject.toml',
      'go.mod',
      'go.sum',
    ],
    mimeType: 'application/json',
    viewerKind: 'json',
    adapters: ['package manifest parser', 'license/security scanner'],
    stages: textConfig,
    productionRoute: 'ready',
  }),
  fileType('code-infra', 'code.infra', 'Infrastructure config', [], {
    exactNames: ['Dockerfile', 'docker-compose.yml', 'Makefile', '.gitignore', '.dockerignore', '.env', '.env.local'],
    suffixNames: ['.env.local', '.env.development', '.env.production', '.env.test'],
    mimeType: 'text/plain',
    viewerKind: 'text',
    adapters: ['Docker/Compose parser', 'infra policy scanner'],
    stages: textConfig,
    productionRoute: 'ready',
  }),
  fileType('openapi-schema', 'code.schema', 'OpenAPI schema', [], {
    exactNames: ['openapi.json'],
    suffixNames: ['.openapi.yaml', '.openapi.yml'],
    mimeType: 'application/vnd.oai.openapi+json',
    viewerKind: 'json',
    adapters: ['OpenAPI validator', 'SDK generator'],
    stages: textConfig,
    productionRoute: 'ready',
  }),
  fileType('code-notebook', 'code.notebook', 'Notebook', ['.ipynb'], {
    mimeType: 'application/x-ipynb+json',
    viewerKind: 'json',
    adapters: ['notebook parser/sandbox'],
    stages: externalProcess,
    productionRoute: 'external_process_required',
  }),
  fileType(
    'code-binary-artifact',
    'code.package',
    'Binary/runtime artifact',
    ['.dll', '.class', '.exe', '.so'],
    {
      mimeType: 'application/octet-stream',
      viewerKind: 'text',
      adapters: ['binary signature reader', 'SBOM/security scanner'],
      stages: externalProcess,
      productionRoute: 'external_process_required',
    },
  ),
  fileType(
    'archive-package',
    'pdf.archive',
    'Archive/package',
    ['.zip', '.zipx', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.zst'],
    {
      mimeType: 'application/zip',
      viewerKind: 'archive',
      adapters: ['ZIP central directory reader', 'PeaZip/NanaZip-compatible archive worker'],
      stages: archiveNativePreview,
      productionRoute: 'external_process_required',
    },
  ),
] as const satisfies readonly FileTypeRegistryEntry[];

export const logicalFileTypeRegistry = requestedLogicalFileTypes.map((id) => {
  const backingFileTypes = fileTypeRegistry.filter(
    (entry) => entry.logicalType === id,
  );

  return {
    id,
    supportedByDefault: backingFileTypes.length > 0,
    backingFileTypeIds: backingFileTypes.map((entry) => entry.id),
    stages: backingFileTypes[0]?.stages ?? logicalPolicyForId(id),
    productionRoute:
      backingFileTypes[0]?.productionRoute ?? productionRouteForLogicalType(id),
  };
}) satisfies readonly LogicalFileTypeRegistryEntry[];

function route(
  mode: FileProcessingMode,
  status: FileStageStatus,
  adapter: string,
): FileStageRoute {
  return { mode, status, adapter };
}

function policy(
  overrides: Partial<Record<FileProcessingStage, FileStageRoute>>,
): FileStagePolicy {
  return {
    store: route('native', 'ready', 'object store binding'),
    preview: route('worker', 'adapter_required', 'preview worker'),
    extract: route('worker', 'adapter_required', 'extract worker'),
    parse: route('worker', 'adapter_required', 'parser worker'),
    convert: route('worker', 'adapter_required', 'conversion worker'),
    validate: route('worker', 'adapter_required', 'validation worker'),
    runtime: route('worker', 'adapter_required', 'runtime adapter'),
    ...overrides,
  };
}

function fileType(
  id: string,
  logicalType: string,
  label: string,
  extensions: readonly string[],
  input: Omit<
    FileTypeRegistryEntry,
    'id' | 'logicalType' | 'label' | 'extensions'
  >,
): FileTypeRegistryEntry {
  return {
    id,
    logicalType,
    label,
    extensions: extensions.map(normalizeFileExtension),
    ...input,
  };
}

function logicalPolicyForId(
  id: (typeof requestedLogicalFileTypes)[number],
): FileStagePolicy {
  if (id.startsWith('vendor.') && !['vendor.blender'].includes(id)) {
    return licensedVendor;
  }
  if (id === 'vendor.blender') return externalProcess;
  if (id.startsWith('code.')) return textConfig;
  if (id.startsWith('media.')) return browserView;
  if (id.startsWith('office.')) return officeWorker;
  if (id.startsWith('pdf.')) return browserView;
  if (id.startsWith('aec.bim.')) return openBimWorker;
  if (id.startsWith('aec.gis') || id.startsWith('aec.citymodel')) {
    return gisWorker;
  }
  if (id.startsWith('cad.')) return cadKernelWorker;
  if (id.startsWith('scan.') || id.startsWith('uav.')) return pointCloudWorker;
  if (id.startsWith('xr.')) return browserEngineering;
  if (id.startsWith('robot.')) return textConfig;
  if (id.startsWith('diagram.')) return diagramWorker;

  return policy({});
}

function productionRouteForLogicalType(
  id: (typeof requestedLogicalFileTypes)[number],
): FileProductionRoute {
  if (id.startsWith('vendor.') && !['vendor.blender'].includes(id)) {
    return 'licensed_adapter_required';
  }
  if (id === 'vendor.blender') return 'external_process_required';
  if (id.startsWith('code.') || id.startsWith('media.')) return 'ready';
  if (id.startsWith('pdf.')) return 'ready';
  return 'adapter_required';
}

export function normalizeFileName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? name).trim();
}

export function normalizeFileExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

export function extensionOf(name: string): string {
  const normalized = normalizeFileName(name);
  const dot = normalized.lastIndexOf('.');
  return dot >= 0 ? normalized.slice(dot).toLowerCase() : '';
}

export function fileTypeForExtension(
  extension: string,
): FileTypeRegistryEntry | undefined {
  const ext = normalizeFileExtension(extension);
  return fileTypeRegistry.find((entry) => entry.extensions.includes(ext));
}

export function fileTypeForFileName(
  name: string,
): FileTypeRegistryEntry | undefined {
  const normalized = normalizeFileName(name).toLowerCase();
  const exactMatch = fileTypeRegistry.find((entry) =>
    entry.exactNames?.some((exact) => exact.toLowerCase() === normalized),
  );
  if (exactMatch) return exactMatch;

  const suffixMatch = fileTypeRegistry.find((entry) =>
    entry.suffixNames?.some((suffix) => normalized.endsWith(suffix)),
  );
  if (suffixMatch) return suffixMatch;

  return fileTypeForExtension(extensionOf(normalized));
}

export function inferRegistryMimeType(
  name: string,
  fallback = 'application/octet-stream',
): string {
  return fileTypeForFileName(name)?.mimeType ?? fallback;
}

export function viewerKindForFileName(name: string): FileViewerKind {
  return fileTypeForFileName(name)?.viewerKind ?? 'unknown';
}

export function stageRouteForFileName(
  name: string,
  stage: FileProcessingStage,
): FileStageRoute | undefined {
  return fileTypeForFileName(name)?.stages[stage];
}

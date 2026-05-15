declare module 'occt-import-js' {
  export interface OcctImportOptions {
    locateFile?: (path: string, prefix: string) => string;
  }

  export interface OcctImportParams {
    linearUnit?: 'millimeter' | 'centimeter' | 'meter' | 'inch' | 'foot';
    linearDeflectionType?: 'bounding_box_ratio' | 'absolute_value';
    linearDeflection?: number;
    angularDeflection?: number;
  }

  export interface OcctMesh {
    name?: string;
    color?: number[];
    attributes: {
      position: {
        array: number[];
      };
      normal?: {
        array: number[];
      };
    };
    index?: {
      array: number[];
    };
  }

  export interface OcctImportResult {
    success: boolean;
    meshes?: OcctMesh[];
    root?: unknown;
    error?: string;
  }

  export interface OcctApi {
    ReadBrepFile(
      content: Uint8Array,
      params: OcctImportParams | null,
    ): OcctImportResult;
    ReadStepFile(
      content: Uint8Array,
      params: OcctImportParams | null,
    ): OcctImportResult;
    ReadIgesFile(
      content: Uint8Array,
      params: OcctImportParams | null,
    ): OcctImportResult;
  }

  export default function occtimportjs(
    options?: OcctImportOptions,
  ): Promise<OcctApi>;
}

// Database Manager CRUD contracts.
// License: Apache-2.0

export interface PostgresCrudColumn {
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: string;
  isPrimaryKey: boolean;
}

export interface PostgresCrudTable {
  schemaName: string;
  tableName: string;
  tableType: string;
  estimatedRows: number;
  primaryKeyColumns: string[];
  columns: PostgresCrudColumn[];
}

export interface PostgresRowsResponse {
  schemaName: string;
  tableName: string;
  limit: number;
  offset: number;
  totalRows: number;
  primaryKeyColumns: string[];
  columns: PostgresCrudColumn[];
  rows: Array<Record<string, unknown>>;
}

export interface PostgresMutationResponse {
  schemaName: string;
  tableName: string;
  affectedRows: number;
  rows: Array<Record<string, unknown>>;
}

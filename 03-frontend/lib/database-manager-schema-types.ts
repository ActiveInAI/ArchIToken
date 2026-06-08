// lib/database-manager-schema-types.ts
// License: Apache-2.0

export interface PostgresSchemaGraph {
  engine: "postgresql";
  source: string;
  tableCount: number;
  viewCount: number;
  columnCount: number;
  foreignKeyCount: number;
  totalBytes: number;
  estimatedRows: number;
  tables: PostgresSchemaTable[];
  foreignKeys: PostgresForeignKey[];
}

export interface PostgresSchemaTable {
  schemaName: string;
  tableName: string;
  tableType: string;
  family: string;
  estimatedRows: number;
  totalBytes: number;
  primaryKeyColumns: string[];
  columns: PostgresSchemaColumn[];
}

export interface PostgresSchemaColumn {
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: string;
  isPrimaryKey: boolean;
}

export interface PostgresForeignKey {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  ordinalPosition: number;
  updateRule: string;
  deleteRule: string;
}

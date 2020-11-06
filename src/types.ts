import { Config } from "arangojs/connection";

// export interface SearchResult {
//   data: any[];
//   size: number;
//   total: number;
//   options: any;
// }

export interface UntypedObject {
  [key: string]: string;
}

export interface KeyValue {
  key: string;
  value: string;
}

export interface UniqueValue {
  unique: KeyValue;
}

export interface CompositeKey {
  composite: KeyValue[];
}

export interface UniqueConstraint {
  collection: string;
  constraints: (UniqueValue | CompositeKey)[];
  excludeDocumentKey?: string;
}

export interface UniqueConstraintResult {
  unique: boolean;
  documents?: any[];
}

export const enum QueryType {
  STRING = "string",
  AQL = "aql",
}

export interface DatabaseConfig extends Config {
  hello?: boolean;
}

export interface CreateDocumentOptions {
  stripUnderscoreProps?: boolean;
}

export interface ReadDocumentOptions {
  stripInternalProps?: boolean;
  stripUnderscoreProps?: boolean;
}

export interface GraphDefinition {
  graph: string;
  edges: EdgeDefinition[];
}

export interface EdgeDefinition {
  collection: string;
  from: string | string[];
  to: string | string[];
}

export interface DBStructure {
  database: string;
  collections?: string[];
  graphs?: GraphDefinition[];
}

export interface DBStructureValidation {
  message?: string;
  database?: EntityExists;
  collections?: EntityExists[];
  graphs?: EntityExists[];
}

export interface DBStructureResult {
  database?: string;
  collections?: string[];
  graphs?: string[];
}

export const enum DBClearanceMethod {
  DELETE_DATA = "DELETE_DATA",
  RECREATE_DB = "RECREATE_DB",
}

/** @internal */
export interface EntityExists {
  name: string;
  exists: boolean;
}

/** @internal */
export interface EntityAvailability {
  all: EntityExists[];
  missing: string[];
  existing: string[];
  allExist: boolean;
}

/** @internal */
export function isGraphDefinition(x: any): x is GraphDefinition {
  return x.graph;
}

/** @internal */
export function isGraphDefinitionArray(x: any[]): x is GraphDefinition[] {
  return x.length > 0 && isGraphDefinition(x[0]);
}

/** @internal */
export function isUniqueValue(x: any): x is UniqueValue {
  return x.unique;
}

/** @internal */
export function isCompositeKey(x: any): x is CompositeKey {
  return x.composite;
}

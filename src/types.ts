import { Database } from "arangojs";
import { Config } from "arangojs/connection";

// export interface SearchResult {
//   data: any[];
//   size: number;
//   total: number;
//   options: any;
// }

/** @internal */
export interface MemPool {
  [key: string]: Database;
}

export interface UntypedObject {
  [key: string]: string;
}

export interface KV {
  key: string;
  value: string;
}

export interface UniqueValue {
  unique: KV;
}

export interface CompositeKey {
  composite: KV[];
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

export const enum DBClearanceMethod {
  DELETE_DATA = "DELETE_DATA",
  RECREATE_DB = "RECREATE_DB",
}

/** @internal */
export function isGraphDefinition(x: any): x is GraphDefinition {
  return x.graph;
}

/** @internal */
export function isGraphDefinitionArray(x: any[]): x is GraphDefinition[] {
  return x.length > 0 && isGraphDefinition(x[0]);
}

export function isKV(x: any): x is KV {
  return x.key && x.value;
}

export function isUniqueValue(x: any): x is UniqueValue {
  return x.unique;
}

export function isCompositeKey(x: any): x is CompositeKey {
  return x.composite;
}

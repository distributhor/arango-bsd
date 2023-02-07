import { CollectionReadOptions } from 'arangojs/collection'
import { Config } from 'arangojs/connection'
import { CursorExtras } from 'arangojs/cursor'
import { QueryOptions } from 'arangojs/database'
import { DocumentData, DocumentSelector, Patch } from 'arangojs/documents'

// export interface SearchResult {
//   data: any[];
//   size: number;
//   total: number;
//   options: any;
// }

export interface UntypedObject {
  [key: string]: any
}

export interface NamedValue {
  name: string
  value: any
}

export interface IndexedValue {
  index: number
  value: string
}

export interface UniqueValue {
  unique: NamedValue
}

export interface CompositeKey {
  composite: NamedValue[]
}

export interface UniqueConstraint {
  collection: string
  constraints: Array<UniqueValue | CompositeKey>
  excludeDocumentKey?: string
}

export interface UniqueConstraintResult {
  violatesUniqueConstraint: boolean
  documents?: any[]
}

export enum QueryType {
  STRING = 'string',
  AQL = 'aql',
}

export enum QueryReturnType {
  DOCUMENTS = 'documents',
  CURSOR = 'cursor',
}

// export interface SearchResult {
//   data: any[];
//   size: number;
//   total: number;
//   options: any;
// }

export interface QueryResult<T = any> {
  data: T[]
  meta?: QueryMeta
  extra?: CursorExtras
}

export interface QueryMeta {
  count?: number
  fullCount?: number
}

export enum MatchType {
  ANY = 'ANY',
  ALL = 'ALL',
}

export enum MatchTypeOperator {
  ANY = '||',
  ALL = '&&',
}

export interface ListOfFilters {
  filters: string[]
  match?: MatchType
}

export interface DatabaseConfig extends Config {
  hello?: boolean
}

export interface Identifier {
  identifier?: string
}

export interface OmitOptions {
  private?: boolean
  props?: string[]
}

export interface ReadDocumentOptions extends CollectionReadOptions, Identifier {
  omit?: OmitOptions
}

export interface UpdateDocument<T extends Record<string, any> = any> extends Identifier {
  id: DocumentSelector
  data: Patch<DocumentData<T>>
}

export interface DeleteDocument extends Identifier {
  id: DocumentSelector
}

export interface FetchOptions {
  omit?: OmitOptions
  query?: QueryOptions
  sort?: SortOptions
  return?: QueryReturnType
}

export interface SortOptions {
  sortBy?: string
  sortOrder?: string
}

export interface GraphDefinition {
  graph: string
  edges: EdgeDefinition[]
}

export interface EdgeDefinition {
  collection: string
  from: string | string[]
  to: string | string[]
}

export interface DBStructure {
  collections?: string[]
  graphs?: GraphDefinition[]
}

export interface DBStructureValidation {
  message?: string
  database?: EntityExists
  collections?: EntityExists[]
  graphs?: EntityExists[]
}

export interface DBStructureResult {
  database?: string
  collections?: string[]
  graphs?: string[]
  error?: any
}

export const enum DBClearanceMethod {
  DELETE_DATA = 'DELETE_DATA',
  RECREATE_DB = 'RECREATE_DB',
}

/** @internal */
export interface EntityExists {
  name: string
  exists: boolean
}

/** @internal */
export interface EntityAvailability {
  all: EntityExists[]
  missing: string[]
  existing: string[]
  allExist: boolean
}

/** @internal */
export function isGraphDefinition(x: any): x is GraphDefinition {
  return x.graph
}

/** @internal */
export function isGraphDefinitionArray(x: any[]): x is GraphDefinition[] {
  return x.length > 0 && isGraphDefinition(x[0])
}

/** @internal */
export function isUniqueValue(x: any): x is UniqueValue {
  return x.unique
}

/** @internal */
export function isCompositeKey(x: any): x is CompositeKey {
  return x.composite
}

/*
export enum NegationOperator {
  NOT = "NOT",
}

export enum LogicalOperator {
  AND = "AND",
  OR = "OR",
}

export const LogicalOperatorSign = {
  AND: "&&",
  OR: "||",
  and: "&&",
  or: "||",
};

export enum ComparisonOperator {
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  LESS = "LESS",
  GREATER = "GREATER",
  LESS_OR_EQUAL = "LESS_OR_EQUAL",
  GREATER_OR_EQUAL = "GREATER_OR_EQUAL",
  IN = "IN",
  NOT_IN = "NOT_IN",
  LIKE = "LIKE",
  NOT_LIKE = "NOT_LIKE",
  REGEX = "REGEX",
  NOT_REGEX = "NOT_REGEX",
  EMPTY = "EMPTY",
  NOT_EMPTY = "NOT_EMPTY",
}

export const ComparisonOperatorSign = {
  EQUAL: "==",
  NOT_EQUAL: "!=",
  EMPTY: "EMPTY",
  NOT_EMPTY: "NOT_EMPTY",
  LIKE: "LIKE",
};
*/

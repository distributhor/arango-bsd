import { Config } from 'arangojs/connection'
import { CursorExtras } from 'arangojs/cursor'
import { QueryOptions } from 'arangojs/database'

// export interface SearchResult {
//   data: any[];
//   size: number;
//   total: number;
//   options: any;
// }

export interface UntypedObject {
  [key: string]: any
}

export interface PropertyValue {
  property: string
  value: any
}

export interface IndexValue {
  index: number
  value: string
}

export interface UniqueValue {
  unique: PropertyValue
}

export interface CompositeKey {
  composite: PropertyValue[]
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

export interface QueryResult {
  data: any
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

export interface IdentifierOption {
  identifier?: string
}

export interface CreateDocumentOptions {
  stripUnderscoreProps?: boolean
}

export interface ReadDocumentOptions {
  identifier?: string
  stripInternalProps?: boolean
  stripUnderscoreProps?: boolean
}

export interface UpdateDocumentOptions {
  identifier?: string
}

export interface DeleteDocumentOptions {
  identifier?: string
}

export interface FetchOneOptions {
  stripInternalProps?: boolean
  stripUnderscoreProps?: boolean
  queryOptions?: QueryOptions
}

export interface FetchOptions {
  return?: QueryReturnType
  stripInternalProps?: boolean
  stripUnderscoreProps?: boolean
  sortOptions?: SortOptions
  queryOptions?: QueryOptions
}

export interface FindOptions {
  return?: QueryReturnType
  stripInternalProps?: boolean
  stripUnderscoreProps?: boolean
  queryOptions?: QueryOptions
  filterOptions?: FilterOptions
}

export interface FilterOptions {
  prefixPropertyNames?: boolean
  restrictTo?: string
  sortOptions?: SortOptions
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
  database: string
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

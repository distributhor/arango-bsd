import { AqlQuery } from 'arangojs/aql'
import { CursorStats } from 'arangojs/cursor'
import { QueryOptions } from 'arangojs/database'
import { DocumentData, DocumentMetadata, Patch } from 'arangojs/documents'
import { EdgeDefinitionOptions } from 'arangojs/graph'

/** @internal */
export function isFilter(x: any): x is Filter {
  return x.filters && Array.isArray(x.filters)
}

/** @internal */
export function isSearch(x: any): x is SearchTerms {
  return x.properties && (x.terms || x.terms === '')
}

/** @internal */
export function isIdentifier(x: any): x is Identifier {
  return x.value
}

/** @internal */
export function isDocumentUpdate(x: any): x is DocumentUpdate {
  return x.key && x.data
}

export interface PropertyValue {
  property: string
  value: any
  caseSensitive?: boolean
}

export interface PropertyValues {
  properties: PropertyValue | PropertyValue[]
  match?: MatchType
}

export interface Identifier {
  value: string | Number
  property?: string
}

export interface UniqueConstraint {
  singular?: PropertyValue | PropertyValue[]
  composite?: PropertyValue[]
  excludeDocumentKey?: string
}

export interface UniqueConstraintResult {
  violatesUniqueConstraint: boolean
  documents?: any[]
}

export enum MatchType {
  ANY = 'ANY',
  ALL = 'ALL',
}

export enum MatchTypeOperator {
  ANY = '||',
  ALL = '&&',
}

export interface SearchTerms {
  properties: string | string[]
  terms: string | string[]
  match?: MatchType
}

export interface Filter {
  filters: string[] | AqlQuery[]
  match?: MatchType
  options?: FilterOptions
}

export interface FilterOptions {
  autoPrefixPropNames?: boolean
}

export interface Criteria {
  search?: SearchTerms
  filter?: string | AqlQuery | Filter
  match?: MatchType
}

// export interface DatabaseConfig extends Config {
//   guacamole?: GuacamoleOptions
// }

export interface DocumentUpdate<T extends Record<string, any> = any> {
  key: string | Identifier
  data: Patch<DocumentData<T>>
}

export interface DocumentMeta extends DocumentMetadata {
  [key: string]: any
}

export interface GuacamoleOptions {
  printQueries?: boolean
  debugFilters?: boolean
}

export interface DocumentTrimOptions {
  stripPrivateProps?: boolean
  omit?: string | string[]
  keep?: string | string[]
}

export interface FetchOptions {
  guacamole?: GuacamoleOptions
  trim?: DocumentTrimOptions
  query?: QueryOptions
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: string
  returnCursor?: boolean
  returnStats?: boolean
  printQuery?: boolean
  debugFilters?: boolean
}

export interface QueryResult<T = any> {
  data: T[]
  size?: number | undefined
  total?: number | undefined
  fullCount?: number | undefined
  stats?: CursorStats | undefined
}

export interface GraphSchema {
  name: string
  edges: EdgeDefinitionOptions[]
}

export interface GraphRelation<T extends Record<string, any> = any> {
  from: string
  to: string
  data?: DocumentData<T> // EdgeData<T> ???
}

export interface DbStructure {
  collections?: string[]
  graphs?: GraphSchema[]
}

export interface DbStructureValidation {
  message?: string
  database?: EntityExists
  collections?: EntityExists[]
  graphs?: EntityExists[]
}

export interface DbStructureResult {
  database?: string
  collections?: string[]
  graphs?: string[]
  error?: any
}

export const enum DbClearanceStrategy {
  DELETE_DATA = 'DELETE_DATA',
  RECREATE_DB = 'RECREATE_DB',
}

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
export function isGraphSchema(x: any): x is GraphSchema {
  return x.name
}

/** @internal */
export function isGraphSchemaArray(x: any[]): x is GraphSchema[] {
  return x.length > 0 && isGraphSchema(x[0])
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

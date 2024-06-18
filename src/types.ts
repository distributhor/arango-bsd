import { AqlLiteral, AqlQuery } from 'arangojs/aql'
import { DocumentOperationFailure } from 'arangojs/collection'
import { CursorStats } from 'arangojs/cursor'
import { QueryOptions } from 'arangojs/database'
import { DocumentData, DocumentMetadata, ObjectWithKey, Patch } from 'arangojs/documents'

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
export function isDocumentOperationFailure(x: any): x is DocumentOperationFailure {
  return x.errorMessage
}

export function isDocumentUpdate(x: any): x is DocumentUpdate {
  return x.key && x.data
}

export function isLiteralQuery(x: any): x is LiteralQuery {
  return x.query
}

export function isObjectWithKey(x: any): x is ObjectWithKey {
  return x._key
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

export interface DocumentKey {
  collection: string
  key: string
}

export enum GraphFetchStrategy {
  DISTINCT_VERTEX = 'DISTINCT_VERTEX',
  NON_DISTINCT_VERTEX = 'NON_DISTINCT_VERTEX',
  DISTINCT_VERTEX_EDGES_TUPLE = 'DISTINCT_VERTEX_EDGES_TUPLE',
  DISTINCT_VERTEX_EDGES_JOINED = 'DISTINCT_VERTEX_EDGES_JOINED',
  NON_DISTINCT_VERTEX_EDGE_TUPLE = 'NON_DISTINCT_VERTEX_EDGE_TUPLE'
}

export enum EdgeDataScope {
  MERGED = 'MERGED',
  JOINED = 'JOINED',
  NONE = 'NONE'
}

export interface GraphFetchInstruction {
  from: DocumentKey
  graph: string
  direction: string
  strategy?: GraphFetchStrategy
  vertexNameFrom?: string
  vertexNameTo?: string
  edgeName?: string
  vertexTrim?: DocumentTrimOptions
  edgeTrim?: DocumentTrimOptions
  edgeDataScope?: EdgeDataScope
}

export interface GraphFetchOptions {
  strategy?: GraphFetchStrategy
  vertexNameFrom?: string
  vertexNameTo?: string
  vertexTrim?: DocumentTrimOptions
  edgeTrim?: DocumentTrimOptions
  edgeName?: string
  edgeDataScope?: EdgeDataScope
  printQuery?: boolean
}

export interface DocumentUpdate<T extends Record<string, any> = any> {
  key: string | Identifier
  data: Patch<DocumentData<T>>
}

export type DocumentDataWithKey<T extends Record<string, any> = any> = T & Patch<DocumentData<T>> & ({
  _key: string
} | {
  _id: string
})

// export interface BulkDocumentUpdate<T extends Record<string, any> = any> {
//   data: Array<Patch<DocumentData<T>> & ({
//     _key: string
//   } | {
//     _id: string
//   })>
// }

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
  fullCount?: boolean
  returnCursor?: boolean
  returnStats?: boolean
  printQuery?: boolean
  debugFilters?: boolean
}

export interface LiteralQuery {
  query: string | AqlLiteral
  bindVars?: Record<string, any>
}

export interface QueryResult<T = any> {
  data: T[]
  size?: number | undefined
  total?: number | undefined
  stats?: CursorStats | undefined
}

export interface GraphRelation<T extends Record<string, any> = any> {
  from: string
  to: string
  data?: DocumentData<T> // EdgeData<T> ???
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

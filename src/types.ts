import { Config } from 'arangojs/connection'
import { CursorStats } from 'arangojs/cursor'
import { QueryOptions } from 'arangojs/database'
import { DocumentData, DocumentMetadata, Patch } from 'arangojs/documents'

/** @internal */
export function isFilter(x: any): x is Filter {
  return x.filters && Array.isArray(x.filters)
}

/** @internal */
export function isSearch(x: any): x is SearchTerms {
  return x.props && (x.terms || x.terms === '')
}

/** @internal */
export function isIdentifier(x: any): x is Identifier {
  return x.value
}

/** @internal */
export function isUniqueValue(x: any): x is UniqueValue {
  return x.unique
}

/** @internal */
export function isCompositeKey(x: any): x is CompositeKey {
  return x.composite
}

export interface UntypedObject {
  [key: string]: any
}

export interface KeyValue {
  key: string
  value: any
}

export interface IndexValue {
  index: number
  value: string
}

export interface PropertyValue {
  property: string
  value: any
}

export interface PropertyValueSelector {
  propValues: PropertyValue
  match?: MatchType
}

export interface UniqueValue {
  unique: PropertyValue
}

export interface Identifier {
  value: string | Number
  prop?: string
}

export interface CompositeKey {
  composite: PropertyValue[]
}

export interface UniqueConstraint {
  collection: string
  constraints: Array<UniqueValue | CompositeKey>
  caseInsensitive?: boolean
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
  props: string | string[]
  terms: string | string[]
  match?: MatchType
}

export interface Filter {
  filters: string[]
  match?: MatchType
}

export interface Criteria {
  search?: SearchTerms
  filter?: string | Filter
  match?: MatchType
}

export interface DatabaseConfig extends Config {}

export interface GuacamoleOptions {
  autoPrefixPropNamesInFilters?: boolean
  debugFunctions?: boolean
  debugParams?: boolean
  printQueries?: boolean
}

export interface DocumentUpdate<T extends Record<string, any> = any> extends Identifier {
  data: Patch<DocumentData<T>>
}

export interface DocumentMeta extends DocumentMetadata {
  [key: string]: any
}

export interface DocumentTrimOptions {
  trimPrivateProps?: boolean
  trimProps?: string[]
}

export interface ArangoJSOptions {
  query?: QueryOptions
}

export interface FetchOptions extends DocumentTrimOptions {
  arangojs?: ArangoJSOptions
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: string
  returnCursor?: boolean
  printQuery?: boolean
  debugFilters?: boolean
}

export interface QueryResult<T = any> {
  data: T[]
  size?: number | undefined
  total?: number | undefined
  stats?: CursorStats | undefined
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

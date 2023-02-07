import { Config } from 'arangojs/connection';
import { CursorExtras } from 'arangojs/cursor';
import { QueryOptions } from 'arangojs/database';
import { DocumentData, DocumentSelector, Patch } from 'arangojs/documents';
export interface UntypedObject {
    [key: string]: any;
}
export interface NamedValue {
    name: string;
    value: any;
}
export interface IndexedValue {
    index: number;
    value: string;
}
export interface UniqueValue {
    unique: NamedValue;
}
export interface CompositeKey {
    composite: NamedValue[];
}
export interface UniqueConstraint {
    collection: string;
    constraints: Array<UniqueValue | CompositeKey>;
    excludeDocumentKey?: string;
}
export interface UniqueConstraintResult {
    violatesUniqueConstraint: boolean;
    documents?: any[];
}
export declare enum QueryReturnType {
    DOCUMENTS = "documents",
    CURSOR = "cursor"
}
export interface QueryResult<T = any> {
    data: T[];
    meta?: QueryMeta;
    extra?: CursorExtras;
}
export interface QueryMeta {
    count?: number;
    fullCount?: number;
}
export declare enum MatchType {
    ANY = "ANY",
    ALL = "ALL"
}
export declare enum MatchTypeOperator {
    ANY = "||",
    ALL = "&&"
}
export interface ListOfFilters {
    filters: string[];
    match?: MatchType;
}
export interface DatabaseConfig extends Config {
    hello?: boolean;
}
export interface Identifier {
    identifier?: string;
    id: DocumentSelector;
}
export interface DocumentUpdate<T extends Record<string, any> = any> extends Identifier {
    data: Patch<DocumentData<T>>;
}
export interface DocumentTrimOptions {
    trimPrivateProps?: boolean;
    trimProps?: string[];
}
export interface FetchOptions extends DocumentTrimOptions {
    query?: QueryOptions;
    sort?: SortOptions;
    return?: QueryReturnType;
}
export interface SortOptions {
    sortBy?: string;
    sortOrder?: string;
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
    error?: any;
}
export declare const enum DBClearanceMethod {
    DELETE_DATA = "DELETE_DATA",
    RECREATE_DB = "RECREATE_DB"
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
export declare function isGraphDefinition(x: any): x is GraphDefinition;
/** @internal */
export declare function isGraphDefinitionArray(x: any[]): x is GraphDefinition[];
/** @internal */
export declare function isUniqueValue(x: any): x is UniqueValue;
/** @internal */
export declare function isCompositeKey(x: any): x is CompositeKey;
//# sourceMappingURL=types.d.ts.map
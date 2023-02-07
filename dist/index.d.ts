import { Database } from 'arangojs';
import { AqlQuery } from 'arangojs/aql';
import { QueryOptions } from 'arangojs/database';
import { DatabaseConfig, DBStructure, DBStructureResult, DBStructureValidation, DBClearanceMethod, UniqueConstraint, UniqueConstraintResult, FetchOptions, DocumentTrimOptions, QueryResult, NamedValue, ListOfFilters, DocumentUpdate, Identifier } from './types';
import { ArrayCursor } from 'arangojs/cursor';
import { CollectionInsertOptions, CollectionReadOptions, CollectionRemoveOptions, CollectionUpdateOptions, DocumentCollection, EdgeCollection } from 'arangojs/collection';
import { Document, DocumentData, DocumentMetadata, ObjectWithKey } from 'arangojs/documents';
export * from './types';
export declare class ArangoConnection {
    private readonly pool;
    private readonly arangodb;
    private readonly arangojs;
    readonly system: Database;
    constructor(db: Database | DatabaseConfig);
    driver(db: string): Database;
    db(db: string): ArangoDB;
    col<T extends Record<string, any> = any>(db: string, collection: string): DocumentCollection<T> | EdgeCollection<T>;
    listConnections(): string[];
    /** @internal */
    private getInstance;
}
/**
 * A thin wrapper around an `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html)
 * instance. It provides easy access to the ArangoJS instance itself, which can be used as normal,
 * but adds a few convenience methods, which can optionally be used.
 *
 * The constructor accepts an `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html)
 *
 * ```typescript
 * import { aql } from "arangojs/aql";
 * import { ArangoDB } from "@distributhor/guacamole";
 *
 * const db = new ArangoDB({ databaseName: "name", url: "http://127.0.0.1:8529", auth: { username: "admin", password: "letmein" } });
 *
 * // the native ArangoJS driver instance is exposed on the `db.driver` property
 * db.driver.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`);
 *
 * // the backseat driver method, which immediately calls cursor.all()
 * // on the results, returning all the documents, and not the cursor
 * db.fetch(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`);
 * ```
 */
export declare class ArangoDB {
    /**
     * A property that exposes the native `ArangoJS`
     * [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance.
     */
    driver: Database;
    system: Database;
    /**
     * The constructor accepts an existing
     * `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance,
     * **or** an `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) configuration.
     */
    constructor(db: Database | DatabaseConfig);
    get name(): string;
    /**
     * The regular `driver.query` method will return a database cursor. If you wish to just
     * return all the documents in the result at once (same as invoking cursor.all()),
     * then use this method instead.
     *
     * TODO: support for generic types on the retun value
     *
     * @param query  A query, as create by the `aql` function
     * @param options  Driver options that may be passed in along with the query
     * @returns a list of objects
     */
    query<T = any>(query: AqlQuery, options?: QueryOptions): Promise<ArrayCursor<T>>;
    returnAll<T = any>(query: AqlQuery, options?: FetchOptions): Promise<QueryResult<T>>;
    /**
     * Will simply return the first value only of a query. One can quite easily handle
     * this via the `AQL` query itself, but in cases where you have issued a query where
     * you would typically expect either no result or exactly one result, it may convenient
     * to simply use use this function instead
     *
     * @param query  A query, as create by the `aql` function
     * @param options  Driver options that may be passed in along with the query
     * @returns an object
     */
    returnOne<T = any>(query: AqlQuery, options?: FetchOptions): Promise<T | null>;
    col<T extends Record<string, any> = any>(collection: string): DocumentCollection<T> | EdgeCollection<T>;
    read<T extends Record<string, any> = any>(collection: string, document: Identifier, trim?: DocumentTrimOptions, options?: CollectionReadOptions): Promise<Document<T> | null>;
    create<T extends Record<string, any> = any>(collection: string, data: DocumentData<T> | Array<DocumentData<T>>, options?: CollectionInsertOptions): Promise<Array<DocumentMetadata & {
        new?: Document<T>;
    }>>;
    update<T extends Record<string, any> = any>(collection: string, document: DocumentUpdate | any[], options?: CollectionUpdateOptions): Promise<Array<DocumentMetadata & {
        new?: Document<T>;
        old?: Document<T>;
    }>>;
    delete<T extends Record<string, any> = any>(collection: string, document: Identifier | Array<string | ObjectWithKey>, options?: CollectionRemoveOptions): Promise<Array<DocumentMetadata & {
        old?: Document<T>;
    }>>;
    fetchOneByPropertyValue<T = any>(collection: string, identifier: NamedValue, options?: FetchOptions): Promise<T | null>;
    fetchOneByCompositeValue<T = any>(collection: string, identifier: NamedValue[], options?: FetchOptions): Promise<T | null>;
    fetchAllByPropertyValue<T = any>(collection: string, identifier: NamedValue, options?: FetchOptions): Promise<ArrayCursor | QueryResult<T>>;
    fetchAllByCompositeValue<T = any>(collection: string, identifier: NamedValue[], options?: FetchOptions): Promise<ArrayCursor | QueryResult<T>>;
    findByFilterCriteria<T = any>(collection: string, filter: string | ListOfFilters, options?: FetchOptions): Promise<ArrayCursor<T> | QueryResult<T>>;
    uniqueConstraintValidation(constraints: UniqueConstraint): Promise<UniqueConstraintResult>;
    static trimDocument(document: any, options?: DocumentTrimOptions): any;
    static trimDocuments(documents: any[], options?: DocumentTrimOptions): any[];
    clearDB(method?: DBClearanceMethod): Promise<void>;
    dbExists(): Promise<boolean>;
    createDBStructure(structure: DBStructure, clearDB?: DBClearanceMethod): Promise<DBStructureResult>;
    validateDBStructure(structure: DBStructure): Promise<DBStructureValidation>;
    /** @internal */
    private checkAvailableCollections;
    /** @internal */
    private checkAvailableGraphs;
}
//# sourceMappingURL=index.d.ts.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArangoDB = exports.ArangoConnection = void 0;
const debug_1 = __importDefault(require("debug"));
const arangojs_1 = require("arangojs");
const types_1 = require("./types");
const queries_1 = require("./queries");
__exportStar(require("./types"), exports);
/** @internal */
const debugInfo = (0, debug_1.default)('guacamole:info');
/** @internal */
const debugError = (0, debug_1.default)('guacamole:error');
/** @internal */
function toGraphNames(graphs) {
    if (graphs.length === 0) {
        return [];
    }
    if ((0, types_1.isGraphDefinitionArray)(graphs)) {
        return graphs.map((g) => g.graph);
    }
    return graphs;
}
function stripUnderscoreProps(obj, keep) {
    Object.keys(obj).map((k) => {
        if (k.startsWith('_') && !keep.includes(k)) {
            delete obj[k];
        }
        return k;
    });
}
class ArangoConnection {
    constructor(db) {
        this.pool = {};
        this.arangojs = db instanceof arangojs_1.Database ? db : new arangojs_1.Database(db);
        this.arangodb = new ArangoDB(this.arangojs);
        if (this.arangojs.name === '_system') {
            this.system = this.arangojs;
        }
        else {
            this.pool[this.arangojs.name] = this.arangodb;
            this.system = this.arangojs.database('_system');
        }
    }
    driver(db) {
        return this.getInstance(db).driver;
    }
    db(db) {
        return this.getInstance(db);
    }
    col(db, collection) {
        return this.db(db).col(collection);
    }
    listConnections() {
        return Object.keys(this.pool);
    }
    /** @internal */
    getInstance(db) {
        if (this.pool[db]) {
            return this.pool[db];
        }
        debugInfo(`Adding '${db}' to pool`);
        this.pool[db] = new ArangoDB(this.arangojs.database(db));
        return this.pool[db];
    }
}
exports.ArangoConnection = ArangoConnection;
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
class ArangoDB {
    /**
     * The constructor accepts an existing
     * `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance,
     * **or** an `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) configuration.
     */
    constructor(db) {
        if (db instanceof arangojs_1.Database) {
            this.driver = db;
        }
        else {
            this.driver = new arangojs_1.Database(db);
        }
        this.system = this.driver.database('_system');
    }
    get name() {
        return this.driver.name;
    }
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
    query(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.driver.query(query, options);
        });
    }
    returnAll(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.query(query, options === null || options === void 0 ? void 0 : options.query);
            const documents = yield response.all();
            return {
                data: ArangoDB.trimDocuments(documents, options)
            };
        });
    }
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
    returnOne(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.query(query, options === null || options === void 0 ? void 0 : options.query);
            const documents = yield response.all();
            if (!documents || documents.length === 0) {
                return null;
            }
            return ArangoDB.trimDocument(documents.shift(), options);
        });
    }
    col(collection) {
        return this.driver.collection(collection);
    }
    read(collection, document, trim = {}, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let d;
            if (document.identifier) {
                // LET d = DOCUMENT('${collection}/${id}') RETURN UNSET_RECURSIVE( d, [ "_id", "_rev" ])
                d = yield this.fetchOneByPropertyValue(collection, { name: document.identifier, value: document.id });
            }
            else {
                if (options.graceful !== false) {
                    options.graceful = true;
                }
                d = yield this.driver.collection(collection).document(document.id, options);
            }
            if (!d) {
                return null;
            }
            return ArangoDB.trimDocument(d, trim);
        });
    }
    create(collection, data, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(data)) {
                return yield this.driver.collection(collection).saveAll(data, options);
            }
            const result = yield this.driver.collection(collection).save(data, options);
            return [result];
        });
    }
    update(collection, document, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(document)) {
                return yield this.driver.collection(collection).updateAll(document, options);
            }
            if (document.identifier) {
                const query = queries_1.Queries.updateDocumentsByKeyValue(this.driver.collection(collection), { name: document.identifier, value: document.id }, document.data);
                const result = yield this.driver.query(query);
                // [
                //   {
                //     _key: '270228543'
                //   }
                // ]
                return yield result.all();
            }
            const result = yield this.driver.collection(collection).update(document.id, document.data, options);
            // [
            //   {
            //     _id: 'cyclists/270226544',
            //     _key: '270226544',
            //     _rev: '_fgqsdT----',
            //     _oldRev: '_fgqsdS2---'
            //   }
            // ]
            return [result];
        });
    }
    delete(collection, document, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(document)) {
                return yield this.driver.collection(collection).removeAll(document, options);
            }
            if (document.identifier) {
                const query = queries_1.Queries.deleteDocumentsByKeyValue(this.driver.collection(collection), { name: document.identifier, value: document.id });
                const result = yield this.driver.query(query);
                return yield result.all();
            }
            const response = yield this.driver.collection(collection).remove(document.id, options);
            return [response];
        });
    }
    fetchOneByPropertyValue(collection, identifier, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.returnOne(queries_1.Queries.fetchByPropertyValue(collection, identifier), options);
        });
    }
    fetchOneByCompositeValue(collection, identifier, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.returnOne(queries_1.Queries.fetchByCompositeValue(collection, identifier), options);
        });
    }
    fetchAllByPropertyValue(collection, identifier, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.driver.query(queries_1.Queries.fetchByPropertyValue(collection, identifier, options.sort), options === null || options === void 0 ? void 0 : options.query);
            if (options.return && options.return === types_1.QueryReturnType.CURSOR) {
                return result;
            }
            const documents = yield result.all();
            return {
                data: ArangoDB.trimDocuments(documents, options)
            };
        });
    }
    fetchAllByCompositeValue(collection, identifier, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.driver.query(queries_1.Queries.fetchByCompositeValue(collection, identifier, options.sort), options === null || options === void 0 ? void 0 : options.query);
            if (options.return && options.return === types_1.QueryReturnType.CURSOR) {
                return result;
            }
            const documents = yield result.all();
            return {
                data: ArangoDB.trimDocuments(documents, options)
            };
        });
    }
    findByFilterCriteria(collection, filter, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.driver.query(queries_1.Queries.findByFilterCriteria(collection, filter, options), options === null || options === void 0 ? void 0 : options.query);
            if (options.return && options.return === types_1.QueryReturnType.CURSOR) {
                return result;
            }
            const documents = yield result.all();
            return {
                data: ArangoDB.trimDocuments(documents, options)
            };
        });
    }
    uniqueConstraintValidation(constraints) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!constraints || constraints.constraints.length === 0) {
                throw new Error('No constraints specified');
            }
            // const query = Queries.uniqueConstraintQuery(constraints, QueryType.STRING) as string;
            const query = queries_1.Queries.uniqueConstraintQuery(constraints);
            const documents = yield (yield this.query(query)).all();
            return {
                violatesUniqueConstraint: documents.length > 0,
                documents
            };
        });
    }
    static trimDocument(document, options = {}) {
        if (!document) {
            return document;
        }
        if (options.trimPrivateProps) {
            stripUnderscoreProps(document, ['_key']);
            // stripProps(document, ['_id', '_rev'])
        }
        return document;
    }
    static trimDocuments(documents, options = {}) {
        if (options.trimPrivateProps) {
            documents.map((d) => {
                stripUnderscoreProps(d, ['_key']);
                return d;
            });
            // } else if (options.stripInternalProps) {
            //   documents.map((d) => {
            //     stripProps(d, ['_id', '_rev'])
            //     return d
            //   })
        }
        return documents;
    }
    clearDB(method = "DELETE_DATA" /* DBClearanceMethod.DELETE_DATA */) {
        return __awaiter(this, void 0, void 0, function* () {
            const dbExists = yield this.dbExists();
            if (!dbExists) {
                return;
            }
            if (method === "RECREATE_DB" /* DBClearanceMethod.RECREATE_DB */) {
                try {
                    yield this.driver.dropDatabase(this.driver.name);
                    yield this.driver.createDatabase(this.driver.name);
                    debugInfo(`DB ${this.driver.name} re-created`);
                    return;
                }
                catch (e) {
                    throw new Error(`Failed to re-create DB ${this.driver.name}`);
                }
            }
            // TODO: graphs are not cleared yet ?
            (yield this.driver.collections()).map((collection) => __awaiter(this, void 0, void 0, function* () { return yield collection.truncate(); }));
            debugInfo(`DB ${this.driver.name} cleaned`);
        });
    }
    dbExists() {
        return __awaiter(this, void 0, void 0, function* () {
            // if (db) {
            //   driver.listDatabases() will throw an error (database not found) if the db in question doesn't actually exist yet
            //   return (await this.driver.listDatabases()).includes(db)
            // }
            return yield this.driver.exists();
        });
    }
    createDBStructure(structure, clearDB) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(structure === null || structure === void 0 ? void 0 : structure.collections)) {
                throw new Error('No DB structure specified');
            }
            const response = {
                database: undefined,
                collections: [],
                graphs: [],
                error: false
            };
            const dbExists = yield this.dbExists();
            if (!dbExists) {
                debugInfo(`Database '${this.driver.name}' not found`);
                try {
                    yield this.system.createDatabase(this.driver.name);
                    debugInfo(`Database '${this.driver.name}' created`);
                    response.database = 'Database created';
                }
                catch (e) {
                    response.database = 'Failed to create database';
                    response.error = e;
                    debugInfo(`Failed to create database '${this.driver.name}'`);
                    debugError(e);
                    return response;
                }
            }
            else {
                if (clearDB) {
                    yield this.clearDB(clearDB);
                    debugInfo(`Database '${this.driver.name}' cleared with method ${clearDB}`);
                    response.database = `Database cleared with method ${clearDB}`;
                }
                else {
                    debugInfo(`Database '${this.driver.name}' found`);
                    response.database = 'Database found';
                }
            }
            const validation = yield this.validateDBStructure(structure);
            if (validation.collections) {
                if (!response.collections) {
                    response.collections = [];
                }
                for (const entity of validation.collections) {
                    if (!entity.exists) {
                        try {
                            yield this.driver.collection(entity.name).create();
                            response.collections.push(`Collection '${entity.name}' created`);
                        }
                        catch (e) {
                            response.collections.push(`Failed to create collection '${entity.name}'`);
                            response.error = e;
                            debugError(`Failed to create collection '${entity.name}'`);
                            debugError(e);
                            return response;
                        }
                    }
                    else {
                        response.collections.push(`Collection '${entity.name}' found`);
                    }
                }
            }
            if (validation.graphs) {
                if (!response.graphs) {
                    response.graphs = [];
                }
                for (const entity of validation.graphs) {
                    if (!entity.exists) {
                        const graph = structure.graphs
                            ? structure.graphs.filter((graph) => graph.graph === entity.name)[0]
                            : undefined;
                        if ((graph === null || graph === void 0 ? void 0 : graph.edges) && graph.edges.length > 0) {
                            try {
                                yield this.driver.graph(graph.graph).create(graph.edges);
                                response.graphs.push(`Graph '${entity.name}' created`);
                            }
                            catch (e) {
                                response.graphs.push(`Failed to create graph '${entity.name}'`);
                                response.error = e;
                                debugError(`Failed to create graph '${entity.name}'`);
                                debugError(e);
                                return response;
                            }
                        }
                    }
                    else {
                        response.graphs.push(`Graph '${entity.name}' found`);
                    }
                }
            }
            return response;
        });
    }
    validateDBStructure(structure) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = {
                message: undefined,
                database: undefined,
                collections: [],
                graphs: []
            };
            if (!(structure === null || structure === void 0 ? void 0 : structure.collections)) {
                return response;
            }
            const dbExists = yield this.dbExists();
            if (!dbExists) {
                response.message = 'Database does not exist';
                response.database = { name: this.driver.name, exists: false };
                return response;
            }
            response.database = { name: this.driver.name, exists: true };
            const collectionAvailability = yield this.checkAvailableCollections(structure.collections);
            response.collections = collectionAvailability.all;
            if (!collectionAvailability.allExist) {
                response.message = 'Required collections do not exist';
            }
            const graphAvailability = yield this.checkAvailableGraphs(structure.graphs);
            response.graphs = graphAvailability.all;
            if (!graphAvailability.allExist) {
                if (response.message) {
                    response.message = response.message + ', and required graphs do not exist';
                }
                else {
                    response.message = 'Required graphs do not exist';
                }
            }
            return response;
        });
    }
    /** @internal */
    checkAvailableCollections(collections) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = {
                all: [],
                missing: [],
                existing: [],
                allExist: false
            };
            if (!collections || collections.length === 0) {
                return response;
            }
            response.existing = (yield this.driver.listCollections()).map((c) => c.name);
            for (const collection of collections) {
                if (response.existing.includes(collection)) {
                    response.all.push({ name: collection, exists: true });
                }
                else {
                    response.all.push({ name: collection, exists: false });
                    response.missing.push(collection);
                }
            }
            if (response.missing.length === 0) {
                response.allExist = true;
            }
            return response;
        });
    }
    /** @internal */
    checkAvailableGraphs(graphs) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = {
                all: [],
                missing: [],
                existing: [],
                allExist: false
            };
            if (!graphs || graphs.length === 0) {
                return response;
            }
            response.existing = (yield this.driver.listGraphs()).map((c) => c.name);
            for (const graph of toGraphNames(graphs)) {
                if (response.existing.includes(graph)) {
                    response.all.push({ name: graph, exists: true });
                }
                else {
                    response.all.push({ name: graph, exists: false });
                    response.missing.push(graph);
                }
            }
            if (response.missing.length === 0) {
                response.allExist = true;
            }
            return response;
        });
    }
}
exports.ArangoDB = ArangoDB;
//# sourceMappingURL=index.js.map
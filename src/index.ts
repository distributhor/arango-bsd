import Debug from 'debug'
import { Database } from 'arangojs'
import { AqlQuery } from 'arangojs/aql'
import { QueryOptions } from 'arangojs/database'
import {
  DatabaseConfig,
  EntityAvailability,
  GraphDefinition,
  DBStructure,
  DBStructureResult,
  DBStructureValidation,
  DBClearanceMethod,
  isGraphDefinitionArray,
  UniqueConstraint,
  UniqueConstraintResult,
  CreateDocumentOptions,
  ReadDocumentOptions,
  UpdateDocumentOptions,
  DeleteDocumentOptions,
  FetchOptions,
  QueryReturnType,
  FetchOneOptions,
  QueryResult,
  NamedValue,
  ListOfFilters,
  FindOptions
} from './types'
import { Queries } from './queries'
import { ArrayCursor } from 'arangojs/cursor'
import { DocumentCollection, EdgeCollection } from 'arangojs/collection'
import { Graph } from 'arangojs/graph'

export * from './types'

/** @internal */
const debugInfo = Debug('guacamole:info')

/** @internal */
const debugError = Debug('guacamole:error')

/** @internal */
function toGraphNames(graphs: string[] | GraphDefinition[]): string[] {
  if (graphs.length === 0) {
    return []
  }

  if (isGraphDefinitionArray(graphs)) {
    return graphs.map((g) => g.graph)
  }

  return graphs
}

function stripUnderscoreProps(obj: any, keep: string[]): void {
  Object.keys(obj).map((k) => {
    if (k.startsWith('_') && !keep.includes(k)) {
      delete obj[k]
    }

    return k
  })
}

// function stripProps(obj: any, props: string[]): void {
//   Object.keys(obj).map((k) => {
//     if (props.includes(k)) {
//       delete obj[k]
//     }

//     return k
//   })
// }

/** @internal */
interface InstancePool {
  [key: string]: ArangoDB
}

export class ArangoConnection {
  private readonly pool: InstancePool = {}
  private readonly arangodb: ArangoDB
  private readonly arangojs: Database
  public readonly system: Database

  constructor(db: Database | DatabaseConfig) {
    this.arangojs = db instanceof Database ? db : new Database(db)
    this.arangodb = new ArangoDB(this.arangojs)
    if (this.arangojs.name === '_system') {
      this.system = this.arangojs
    } else {
      this.pool[this.arangojs.name] = this.arangodb
      this.system = this.arangojs.database('_system')
    }
  }

  public db(db: string): ArangoDB {
    return this.getInstance(db)
  }

  public driver(db: string): Database {
    return this.getInstance(db).driver
  }

  public col(db: string, collection: string): DocumentCollection<any> | EdgeCollection<any> {
    return this.driver(db).collection(collection)
  }

  public graph(db: string, graph: string): Graph {
    return this.driver(db).graph(graph)
  }

  public listConnections(): string[] {
    return Object.keys(this.pool)
  }

  /** @internal */
  private getInstance(db: string): ArangoDB {
    if (this.pool[db]) {
      return this.pool[db]
    }

    debugInfo(`Adding '${db}' to pool`)
    this.pool[db] = new ArangoDB(this.arangojs.database(db))
    return this.pool[db]
  }
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
 * db.queryAll(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`);
 * ```
 */
export class ArangoDB {
  /**
   * A property that exposes the native `ArangoJS`
   * [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance.
   */
  public driver: Database
  public system: Database

  /**
   * The constructor accepts an existing
   * `ArangoJS` [Database](https://arangodb.github.io/arangojs/8.1.0/classes/database.Database.html) instance,
   * **or** an `ArangoJS` [Config](https://arangodb.github.io/arangojs/8.1.0/types/connection.Config.html) configuration.
   */
  constructor(db: Database | DatabaseConfig) {
    if (db instanceof Database) {
      this.driver = db
    } else {
      this.driver = new Database(db)
    }

    this.system = this.driver.database('_system')
  }

  public get name(): string {
    return this.driver.name
  }

  public col(collection: string): DocumentCollection<any> | EdgeCollection<any> {
    return this.driver.collection(collection)
  }

  public graph(graph: string): Graph {
    return this.driver.graph(graph)
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
  public async queryAll(query: AqlQuery, options?: QueryOptions): Promise<any[]> {
    // const result = await this.driver.query(
    //   Queries.fetchByPropertyValue(collection, identifier, options.sortOptions) as AqlQuery,
    //   options.queryOptions
    // )

    const result = await this.driver.query(query, options)
    return await result.all()
  }

  public async fetchAll(query: AqlQuery, options?: FetchOptions): Promise<any> {
    // TODO : cannot trim documents if query return type is a cursor
    const documents = await this.queryAll(query, options?.query ? options.query : undefined)

    this.trimDocuments(documents, options)

    return {
      data: documents
    }
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
  public async queryOne(query: AqlQuery, options?: QueryOptions): Promise<any> {
    return (await this.queryAll(query, options)).shift()
  }

  public async fetchOne(query: AqlQuery, options?: FetchOneOptions): Promise<any> {
    const document = this.queryOne(query, options?.query ? options.query : undefined)
    return this.trimDocument(document, options)
  }

  public async create(collection: string, document: any, options: CreateDocumentOptions = {}): Promise<any> {
    if (options.omit?.privateProps) {
      if (Array.isArray(document)) {
        document.map((o) => {
          stripUnderscoreProps(o, ['_key'])
          return o
        })
      } else {
        stripUnderscoreProps(document, ['_key'])
      }
    }

    return await this.driver.collection(collection).save(document)
  }

  public async read(collection: string, id: any, options: ReadDocumentOptions = {}): Promise<any> {
    let document

    if (options.idField) {
      // LET d = DOCUMENT('${collection}/${id}') RETURN UNSET_RECURSIVE( d, [ "_id", "_rev" ])
      document = await this.fetchOneByPropertyValue(collection, { name: options.idField, value: id }, options)
    } else {
      try {
        document = await this.driver.collection(collection).document(id)
      } catch (e) {
        // e.errorNum = 1202
        if (e.code && e.code === 404) {
          return undefined
        } else {
          throw e
        }
      }
    }

    return this.trimDocument(document, options)
  }

  public async update(collection: string, id: string, data: any, options: UpdateDocumentOptions = {}): Promise<any> {
    if (options.idField) {
      const query = Queries.updateDocumentsByKeyValue(
        this.driver.collection(collection),
        { name: options.idField, value: id },
        data
      )

      const result = await this.driver.query(query)

      return await result.all()
    }

    return await this.driver.collection(collection).update(id, data)
  }

  public async delete(collection: string, id: string, options: DeleteDocumentOptions = {}): Promise<any> {
    if (options.idField) {
      const query = Queries.deleteDocumentsByKeyValue(
        this.driver.collection(collection),
        { name: options.idField, value: id }
      )

      const result = await this.driver.query(query)

      return await result.all()
    }

    return await this.driver.collection(collection).remove(id)
  }

  private trimDocument(document: any, options: ReadDocumentOptions | FetchOneOptions = {}): any {
    if (!document) {
      return document
    }

    if (options.omit?.privateProps) {
      stripUnderscoreProps(document, ['_key'])
      // stripProps(document, ['_id', '_rev'])
    }

    return document
  }

  private trimDocuments(documents: any[], options: FetchOptions = {}): void {
    if (options.omit?.privateProps) {
      documents.map((d) => {
        stripUnderscoreProps(d, ['_key'])
        return d
      })
    // } else if (options.stripInternalProps) {
    //   documents.map((d) => {
    //     stripProps(d, ['_id', '_rev'])
    //     return d
    //   })
    }
  }

  public async fetchOneByPropertyValue(
    collection: string,
    identifier: NamedValue,
    options: FetchOneOptions = {}
  ): Promise<any> {
    const document = await this.queryOne(
      Queries.fetchByPropertyValue(collection, identifier),
      options.query
    )

    return this.trimDocument(document, options)
  }

  public async fetchOneByCompositeValue(
    collection: string,
    identifier: NamedValue[],
    options: FetchOneOptions = {}
  ): Promise<any> {
    const document = await this.queryOne(
      Queries.fetchByCompositeValue(collection, identifier),
      options.query
    )

    return this.trimDocument(document, options)
  }

  public async fetchAllByPropertyValue(
    collection: string,
    identifier: NamedValue,
    options: FetchOptions = {}
  ): Promise<ArrayCursor | QueryResult> {
    const result = await this.driver.query(
      Queries.fetchByPropertyValue(collection, identifier, options.sort),
      options.query
    )

    if (options.return && options.return === QueryReturnType.CURSOR) {
      return result
    }

    const documents = await result.all()

    this.trimDocuments(documents, options)

    return {
      data: documents
    }
  }

  public async fetchAllByCompositeValue(
    collection: string,
    identifier: NamedValue[],
    options: FetchOptions = {}
  ): Promise<ArrayCursor | QueryResult> {
    const result = await this.driver.query(
      Queries.fetchByCompositeValue(collection, identifier, options.sort),
      options.query
    )

    if (options.return && options.return === QueryReturnType.CURSOR) {
      return result
    }

    const documents = await result.all()

    this.trimDocuments(documents, options)

    return {
      data: documents
    }
  }

  public async findByFilterCriteria(
    collection: string,
    filter: string | ListOfFilters,
    options: FindOptions = {}
  ): Promise<ArrayCursor | QueryResult> {
    const result = await this.driver.query(
      Queries.findByFilterCriteria(collection, filter, options.filter),
      options.query
    )

    if (options.return && options.return === QueryReturnType.CURSOR) {
      return result
    }

    const documents = await result.all()

    this.trimDocuments(documents, options)

    return {
      data: documents
    }
  }

  public async uniqueConstraintValidation(constraints: UniqueConstraint): Promise<UniqueConstraintResult> {
    if (!constraints || constraints.constraints.length === 0) {
      throw new Error('No constraints specified')
    }

    // const query = Queries.uniqueConstraintQuery(constraints, QueryType.STRING) as string;
    const query = Queries.uniqueConstraintQuery(constraints)
    // const documents = await (await this.driver.query(query)).all();
    const documents = await this.queryAll(query)

    return {
      violatesUniqueConstraint: documents.length > 0,
      documents
    }
  }

  public async collectionExists(collection: string): Promise<boolean> {
    // return (await this.driver.listCollections()).map((c) => c.name).includes(collection)
    return await this.driver.collection(collection).exists()
  }

  public async graphExists(graph: string): Promise<boolean> {
    // return (await this.driver.listGraphs()).map((g) => g.name).includes(graph)
    return await this.driver.graph(graph).exists()
  }

  public async databaseExists(): Promise<boolean> {
    // if (db) {
    //   driver.listDatabases() will throw an error (database not found) if the db in question doesn't actually exist yet
    //   return (await this.driver.listDatabases()).includes(db)
    // }

    return await this.driver.exists()
  }

  public async clearDB(method: DBClearanceMethod = DBClearanceMethod.DELETE_DATA): Promise<void> {
    const dbExists = await this.databaseExists()
    if (!dbExists) {
      return
    }

    if (method === DBClearanceMethod.RECREATE_DB) {
      try {
        await this.driver.dropDatabase(this.driver.name)
        await this.driver.createDatabase(this.driver.name)
        debugInfo(`DB ${this.driver.name} re-created`)
        return
      } catch (e) {
        throw new Error(`Failed to re-create DB ${this.driver.name}`)
      }
    }

    // TODO: graphs are not cleared yet ?

    (await this.driver.collections()).map(async (collection) => await collection.truncate())
    debugInfo(`DB ${this.driver.name} cleaned`)
  }

  public async createDBStructure(
    structure: DBStructure,
    clearDB?: DBClearanceMethod
  ): Promise<DBStructureResult> {
    if (!structure?.collections) {
      throw new Error('No DB structure specified')
    }

    const response: DBStructureResult = {
      database: undefined,
      collections: [],
      graphs: [],
      error: false
    }

    const dbExists = await this.databaseExists()

    if (!dbExists) {
      debugInfo(`Database '${this.driver.name}' not found`)

      try {
        await this.system.createDatabase(this.driver.name)
        debugInfo(`Database '${this.driver.name}' created`)
        response.database = 'Database created'
      } catch (e) {
        response.database = 'Failed to create database'
        response.error = e
        debugInfo(`Failed to create database '${this.driver.name}'`)
        debugError(e)
        return response
      }
    } else {
      if (clearDB) {
        await this.clearDB(clearDB)
        debugInfo(`Database '${this.driver.name}' cleared with method ${clearDB}`)
        response.database = `Database cleared with method ${clearDB}`
      } else {
        debugInfo(`Database '${this.driver.name}' found`)
        response.database = 'Database found'
      }
    }

    const validation = await this.validateDBStructure(structure)

    if (validation.collections) {
      if (!response.collections) {
        response.collections = []
      }

      for (const entity of validation.collections) {
        if (!entity.exists) {
          try {
            await this.driver.collection(entity.name).create()
            response.collections.push(`Collection '${entity.name}' created`)
          } catch (e) {
            response.collections.push(`Failed to create collection '${entity.name}'`)
            response.error = e
            debugError(`Failed to create collection '${entity.name}'`)
            debugError(e)
            return response
          }
        } else {
          response.collections.push(`Collection '${entity.name}' found`)
        }
      }
    }

    if (validation.graphs) {
      if (!response.graphs) {
        response.graphs = []
      }

      for (const entity of validation.graphs) {
        if (!entity.exists) {
          const graph = structure.graphs
            ? structure.graphs.filter((graph) => graph.graph === entity.name)[0]
            : undefined

          if (graph?.edges && graph.edges.length > 0) {
            try {
              await this.driver.graph(graph.graph).create(graph.edges)
              response.graphs.push(`Graph '${entity.name}' created`)
            } catch (e) {
              response.graphs.push(`Failed to create graph '${entity.name}'`)
              response.error = e
              debugError(`Failed to create graph '${entity.name}'`)
              debugError(e)
              return response
            }
          }
        } else {
          response.graphs.push(`Graph '${entity.name}' found`)
        }
      }
    }

    return response
  }

  public async validateDBStructure(structure: DBStructure): Promise<DBStructureValidation> {
    const response: DBStructureValidation = {
      message: undefined,
      database: undefined,
      collections: [],
      graphs: []
    }

    if (!structure?.collections) {
      return response
    }

    const dbExists = await this.databaseExists()
    if (!dbExists) {
      response.message = 'Database does not exist'
      response.database = { name: this.driver.name, exists: false }
      return response
    }

    response.database = { name: this.driver.name, exists: true }

    const collectionAvailability = await this.checkAvailableCollections(structure.collections)
    response.collections = collectionAvailability.all

    if (!collectionAvailability.allExist) {
      response.message = 'Required collections do not exist'
    }

    const graphAvailability = await this.checkAvailableGraphs(structure.graphs)
    response.graphs = graphAvailability.all

    if (!graphAvailability.allExist) {
      if (response.message) {
        response.message = response.message + ', and required graphs do not exist'
      } else {
        response.message = 'Required graphs do not exist'
      }
    }

    return response
  }

  /** @internal */
  private async checkAvailableCollections(collections: string[] | undefined): Promise<EntityAvailability> {
    const response: EntityAvailability = {
      all: [],
      missing: [],
      existing: [],
      allExist: false
    }

    if (!collections || collections.length === 0) {
      return response
    }

    response.existing = (await this.driver.listCollections()).map((c) => c.name)

    for (const collection of collections) {
      if (response.existing.includes(collection)) {
        response.all.push({ name: collection, exists: true })
      } else {
        response.all.push({ name: collection, exists: false })
        response.missing.push(collection)
      }
    }

    if (response.missing.length === 0) {
      response.allExist = true
    }

    return response
  }

  /** @internal */
  private async checkAvailableGraphs(graphs: string[] | GraphDefinition[] | undefined): Promise<EntityAvailability> {
    const response: EntityAvailability = {
      all: [],
      missing: [],
      existing: [],
      allExist: false
    }

    if (!graphs || graphs.length === 0) {
      return response
    }

    response.existing = (await this.driver.listGraphs()).map((c) => c.name)

    for (const graph of toGraphNames(graphs)) {
      if (response.existing.includes(graph)) {
        response.all.push({ name: graph, exists: true })
      } else {
        response.all.push({ name: graph, exists: false })
        response.missing.push(graph)
      }
    }

    if (response.missing.length === 0) {
      response.allExist = true
    }

    return response
  }
}

import Debug from "debug";
import { Database } from "arangojs";
import { AqlQuery } from "arangojs/aql";
import { QueryOptions } from "arangojs/database";
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
  QueryType,
} from "./types";
import { toUniqueConstraintQuery } from "./queries";

export * from "./types";

/** @internal */
const debugInfo = Debug("arango-bsd:info");

/** @internal */
const debugError = Debug("arango-bsd:error");

/** @internal */
function toGraphNames(graphs: string[] | GraphDefinition[]): string[] {
  if (graphs.length === 0) {
    return [];
  }

  if (isGraphDefinitionArray(graphs)) {
    return graphs.map((g) => g.graph);
  }

  return graphs;
}

/** @internal */
export interface MemPool {
  [key: string]: ArangoDB;
}

/**
 * A thin wrapper around an `ArangoJS` [Database](https://arangodb.github.io/arangojs/7.1.0/classes/_database_.database.html)
 * instance. It provides easy access to the ArangoJS instance itself, which can be used as per normal,
 * but also adds additional functionality and conenience methods, which can optionally be used.
 *
 * The constructor accepts an existing
 * `ArangoJS` [Database](https://arangodb.github.io/arangojs/7.1.0/classes/_database_.database.html) instance,
 * **or** an `ArangoJS` [Config](https://arangodb.github.io/arangojs/7.1.0/modules/_connection_.html#config)
 * **or** a [[DatabaseConfig]], which is an extension of the normal `Config`.
 *
 * ```typescript
 * import { aql } from "arangojs/aql";
 * import { ArangoDB } from "arango-bsd";
 *
 * const db = new ArangoDB({ databaseName: "name", url: "arangoURI" });
 *
 * // uses the regular ArangoJS driver instance, exposed on the
 * // `db.driver` property which returns the usual cursor
 * db.driver.query(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`);
 *
 * // uses the backseat driver method, which immediately calls cursor.all()
 * // on the results, returning all the documents, and not the cursor
 * db.queryAll(aql`FOR d IN user FILTER d.name LIKE ${name} RETURN d`);
 * ```
 */
export class ArangoDB {
  private pool: MemPool;

  /**
   * A property that exposes the native `ArangoJS`
   * [Database](https://arangodb.github.io/arangojs/7.1.0/classes/_database_.database.html) instance.
   */
  public driver: Database;

  /**
   * The constructor accepts an existing
   * `ArangoJS` [Database](https://arangodb.github.io/arangojs/7.1.0/classes/_database_.database.html) instance,
   * **or** an `ArangoJS` [Config](https://arangodb.github.io/arangojs/7.1.0/modules/_connection_.html#config)
   * **or** a [[DatabaseConfig]], which is an extension of the normal `Config`.
   */
  constructor(databaseOrConfig: Database | DatabaseConfig) {
    if (databaseOrConfig instanceof Database) {
      this.driver = databaseOrConfig;
    } else {
      this.driver = new Database(databaseOrConfig);
    }

    this.pool = {};
  }

  public db(db: string): ArangoDB {
    return this.fromPool(db);
  }

  public getDriver(db?: string): Database {
    return db ? this.fromPool(db).driver : this.driver;
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
    return (await this.driver.query(query, options)).all();
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
    return (await this.queryAll(query, options)).shift();
  }

  public async create(collection: string, data: any): Promise<any> {
    // const isBulk = Array.isArray(data) ? true : false;
    // if (isBulk) {
    //   for (let item of data) {
    //     if (item.hasOwnProperty("_key")) {
    //       if (item._key == "" || !this._isString(item._key)) {
    //         delete item._key;
    //         delete item._id;
    //       }
    //     }
    //   }
    // } else {
    //   if (data.hasOwnProperty("_key")) {
    //     if (data._key == "" || !this._isString(data._key)) {
    //       delete data._key;
    //       delete data._id;
    //     }
    //   }
    // }

    return this.driver.collection(collection).save(data);
  }

  public async uniqueConstraintValidation(constraints: UniqueConstraint): Promise<UniqueConstraintResult> {
    if (!constraints || constraints.constraints.length === 0) {
      return;
    }

    // const query = toUniqueConstraintQuery(constraints, QueryType.STRING) as string;
    const query = toUniqueConstraintQuery(constraints, QueryType.AQL) as AqlQuery;
    const documents = await (await this.driver.query(query)).all();

    return {
      unique: documents.length > 0 ? false : true,
      documents,
    };
  }

  public async collectionExists(collection: string): Promise<boolean> {
    return (await this.driver.listCollections()).map((c) => c.name).includes(collection);
  }

  public async graphExists(graph: string): Promise<boolean> {
    return (await this.driver.listGraphs()).map((g) => g.name).includes(graph);
  }

  // same as driver.exists, so not useful for checking if current instance exists,
  // but usefull for checking if a different instance exists
  public async databaseExists(db: string): Promise<boolean> {
    return (await this.driver.listDatabases()).includes(db);
  }

  public async clearDatabase(db: string, method: DBClearanceMethod = DBClearanceMethod.DELETE_DATA): Promise<void> {
    const dbExists = await this.databaseExists(db);
    if (!dbExists) {
      return;
    }

    if (method === DBClearanceMethod.RECREATE_DB) {
      try {
        await this.driver.dropDatabase(db);
        await this.driver.createDatabase(db);
        debugInfo(`DB ${db} re-created`);
        return;
      } catch (e) {
        throw new Error(`Failed to re-create DB ${db}`);
      }
    }

    // TODO: graphs are not cleared yet ?

    (await this.getDriver(db).collections()).map((collection) => collection.truncate());
    debugInfo(`DB ${db} cleaned`);
  }

  public async createDBStructure(structure: DBStructure, clearDB?: DBClearanceMethod): Promise<DBStructureResult> {
    if (!structure || !structure.database) {
      return { database: "Database not specified" };
    }

    const response: DBStructureResult = {
      database: undefined,
      collections: [],
      graphs: [],
    };

    const dbExists = await this.databaseExists(structure.database);

    if (!dbExists) {
      debugInfo(`Database '${structure.database}' not found`);

      try {
        await this.driver.createDatabase(structure.database);
        debugInfo(`Database '${structure.database}' created`);
        response.database = "Database created";
      } catch (e) {
        response.database = "Failed to create database";
        debugInfo(`Failed to create database '${structure.database}'`);
        debugError(e);
        return response;
      }
    } else {
      if (clearDB) {
        await this.clearDatabase(structure.database, clearDB);
        debugInfo(`Database '${structure.database}' cleared with method ${clearDB}`);
        response.database = `Database cleared with method ${clearDB}`;
      } else {
        debugInfo(`Database '${structure.database}' found`);
        response.database = "Database found";
      }
    }

    const validation = await this.validateDBStructure(structure);

    for (const entity of validation.collections) {
      if (!entity.exists) {
        try {
          await this.getDriver(structure.database).collection(entity.name).create();
          response.collections.push(`Collection '${entity.name}' created`);
        } catch (e) {
          response.collections.push(`Failed to create collection '${entity.name}'`);
          debugError(`Failed to create collection '${entity.name}'`);
          debugError(e);
        }
      } else {
        response.collections.push(`Collection '${entity.name}' found`);
      }
    }

    for (const entity of validation.graphs) {
      if (!entity.exists) {
        const graph = structure.graphs.filter((graph) => graph.graph === entity.name)[0];
        if (graph && graph.edges && graph.edges.length > 0) {
          try {
            await this.getDriver(structure.database).graph(graph.graph).create(graph.edges);
            response.graphs.push(`Graph '${entity.name}' created`);
          } catch (e) {
            response.graphs.push(`Failed to create graph '${entity.name}'`);
            debugError(`Failed to create graph '${entity.name}'`);
            debugError(e);
          }
        }
      } else {
        response.graphs.push(`Graph '${entity.name}' found`);
      }
    }

    return response;
  }

  public async validateDBStructure(structure: DBStructure): Promise<DBStructureValidation> {
    const response: DBStructureValidation = {
      message: null,
      database: null,
      collections: [],
      graphs: [],
    };

    if (!structure || !structure.database) {
      return response;
    }

    const dbExists = await this.databaseExists(structure.database);
    if (!dbExists) {
      response.message = "Database does not exist";
      response.database = { name: structure.database, exists: false };
      return response;
    }

    response.database = { name: structure.database, exists: true };

    const collectionAvailability = await this.checkAvailableCollections(structure.database, structure.collections);
    response.collections = collectionAvailability.all;

    if (!collectionAvailability.allExist) {
      response.message = "Required collections do not exist";
    }

    const graphAvailability = await this.checkAvailableGraphs(structure.database, structure.graphs);
    response.graphs = graphAvailability.all;

    if (!graphAvailability.allExist) {
      if (response.message) {
        response.message = response.message + ", and required graphs do not exist";
      } else {
        response.message = "Required graphs do not exist";
      }
    }

    return response;
  }

  /** @internal */
  private async checkAvailableCollections(db: string, collections: string[]): Promise<EntityAvailability> {
    const response: EntityAvailability = {
      all: [],
      missing: [],
      existing: [],
      allExist: false,
    };

    if (!collections || collections.length === 0) {
      return response;
    }

    response.existing = (await this.getDriver(db).listCollections()).map((c) => c.name);

    for (const collection of collections) {
      if (response.existing.includes(collection)) {
        response.all.push({ name: collection, exists: true });
      } else {
        response.all.push({ name: collection, exists: false });
        response.missing.push(collection);
      }
    }

    if (response.missing.length === 0) {
      response.allExist = true;
    }

    return response;
  }

  /** @internal */
  private async checkAvailableGraphs(db: string, graphs: string[] | GraphDefinition[]): Promise<EntityAvailability> {
    const response: EntityAvailability = {
      all: [],
      missing: [],
      existing: [],
      allExist: false,
    };

    if (!graphs || graphs.length === 0) {
      return response;
    }

    response.existing = (await this.getDriver(db).listGraphs()).map((c) => c.name);

    for (const graph of toGraphNames(graphs)) {
      if (response.existing.includes(graph)) {
        response.all.push({ name: graph, exists: true });
      } else {
        response.all.push({ name: graph, exists: false });
        response.missing.push(graph);
      }
    }

    if (response.missing.length === 0) {
      response.allExist = true;
    }

    return response;
  }

  /** @internal */
  private fromPool(db: string): ArangoDB {
    if (!this.pool) {
      this.pool = {};
    }

    if (!this.pool[db]) {
      debugInfo(`Adding '${db}' to pool`);
      this.pool[db] = new ArangoDB(this.driver.database(db));
    }

    debugInfo(`Returning '${db}' from pool`);
    return this.pool[db];
  }
}

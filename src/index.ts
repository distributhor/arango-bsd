import { Database } from "arangojs";
import { Config } from "arangojs/connection";
import { QueryOptions } from "arangojs/database";
import { GeneratedAqlQuery } from "arangojs/aql";
import { ArrayCursor } from "arangojs/cursor";

export interface DatabaseConfig extends Config {
  hello?: boolean;
}

/** @internal */
export interface SearchResult {
  data: any[];
  size: number;
  total: number;
  options: any;
}

/**
 * A thin wrapper around an `ArangoJS` [Database](https://arangodb.github.io/arangojs/7.1.0/classes/_database_.database.html)
 * instance. It provides easy access to the ArangoJS instance itself, so that it can be used as normal,
 * but also adds additional, optional functionality.
 *
 * It takes a regular `ArangoJS` [Config](https://arangodb.github.io/arangojs/7.1.0/modules/_connection_.html#config) as the
 * constructor argument, or alternatively an extended [[DatabaseConfig]].
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
  public driver: Database;

  constructor(databaseOrConfig: Database | DatabaseConfig) {
    if (databaseOrConfig instanceof Database) {
      this.driver = databaseOrConfig;
    } else {
      this.driver = new Database(databaseOrConfig);
    }
  }

  public native = (): Database => {
    return this.driver;
  };

  public queryAll = async (query: GeneratedAqlQuery, options?: QueryOptions): Promise<any> => {
    const cursor: ArrayCursor = await this.driver.query(query, options);
    return await cursor.all();
  };

  public queryOne = async (query: GeneratedAqlQuery, options?: QueryOptions): Promise<any> => {
    const result = await this.queryAll(query, options);
    return result.length > 0 ? result[0] : undefined;
    // if (result.length === 0) {
    //   return null;
    // }
    // if (result.length === 1) {
    //   return result[0];
    // }
    // throw new Error("More than one result");
  };
}

import { Database } from "arangojs";
import { Config } from "arangojs/connection";
import { QueryOptions } from "arangojs/database";
import { GeneratedAqlQuery } from "arangojs/aql";
import { ArrayCursor } from "arangojs/cursor";

export interface DatabaseConfig extends Config {
  hello?: boolean;
}

export interface SearchResult {
  data: any[];
  size: number;
  total: number;
  options: any;
}

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

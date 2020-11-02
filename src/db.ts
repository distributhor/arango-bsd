import { Database, aql } from "arangojs";
import { GeneratedAqlQuery } from "arangojs/lib/cjs/aql-query";
import { InsertOptions } from "arangojs/lib/cjs/util/types";
import { ArrayCursor } from "arangojs/lib/cjs/cursor";
import { QueryOptions } from "arangojs/lib/cjs/database";

export interface DatabaseConfig {
  url: string;
  name?: string;
  user?: string;
  password?: string;
}

export interface Document {
  _key: string;
  _id?: number;
  _rev?: number;
  _from?: string;
  _to?: string;
  [key: string]: any;
}

export interface SearchResult {
  data: any[];
  size: number;
  total: number;
  options: any;
}

const util = {
  isString: (x: any): x is string => {
    return typeof x === "string";
  },

  isObject: (x: any): x is object => {
    if (!x) {
      return false;
    }

    if (typeof x === "object" && x.constructor !== Array) {
      return true;
    }

    return false;
  },

  isArray: (x: any): x is [] => {
    if (!x) {
      return false;
    }

    if (x.constructor === Array) {
      return true;
    }

    return false;
  },

  isNumber: (x: any): x is number => {
    return typeof x === "number";
  },

  isNumeric: (x: any): boolean => {
    return !isNaN(parseFloat(x)) && isFinite(x);
  }
};

const removeDocumentKeyIfEmpty = (document: Partial<Document>) => {
  if (document.hasOwnProperty("_key") && document._key == "") {
    delete document._key;
    delete document._id;
  }
};

export class ArangoDB {
  db: Database;

  constructor(database: Database | DatabaseConfig) {
    if (database instanceof Database) {
      this.db = database;
    } else {
      this.db = new Database({ url: database.url });
      if (database.name) {
        this.db.useDatabase(database.name);
      }
      if (database.user && database.password) {
        this.db.useBasicAuth(database.user, database.password);
      }
    }
  }

  public native = (): Database => {
    return this.db;
  };

  public query = async (query: GeneratedAqlQuery, options?: QueryOptions): Promise<any> => {
    const cursor: ArrayCursor = await this.db.query(query, options);
    return await cursor.all();
  };

  public queryOne = async (query: GeneratedAqlQuery, options?: QueryOptions): Promise<any> => {
    const result = await this.query(query, options);
    if (result.length === 0) {
      return null;
    }
    if (result.length === 1) {
      return result[0];
    }
    throw new Error("More than one result");
  };

  public fetch = async (query: GeneratedAqlQuery, options?: QueryOptions): Promise<SearchResult> => {
    const cursor = await this.db.query(query, options);
    const data = await cursor.all();
    return {
      data,
      size: cursor.count || data.length,
      total: cursor.extra.stats.fullCount || undefined,
      options
    };
  };

  public create = async (collection: string, document: object | object[], opts?: boolean | InsertOptions) => {
    if (util.isArray(document)) {
      document.map(removeDocumentKeyIfEmpty);
    } else {
      removeDocumentKeyIfEmpty(document);
    }

    return await this.db.collection(collection).save(document);
  };

  public import = async (collection: string, document: string | any[] | Buffer | Blob) => {
    return await this.db.collection(collection).import(document);
  };
}

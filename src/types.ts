import { Database } from "arangojs";
import { Config } from "arangojs/connection";

// export interface SearchResult {
//   data: any[];
//   size: number;
//   total: number;
//   options: any;
// }

/** @internal */
export interface MemPool {
  [key: string]: Database;
}

export interface DatabaseConfig extends Config {
  hello?: boolean;
}

export interface GraphDefinition {
  graphName: string;
  edgeDefinitions: EdgeDefinition[];
}

export interface EdgeDefinition {
  collection: string;
  from: string | string[];
  to: string | string[];
}

export interface DBStructure {
  database: string;
  collections: string[];
  graphs: GraphDefinition[];
}

export interface DBStructureValidation {
  database: EntityExists;
  collections: EntityExists[];
  graphs: EntityExists[];
  message: string;
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

export const enum DBClearanceMethod {
  DELETE_DATA = "DELETE_DATA",
  RECREATE_DB = "RECREATE_DB",
}

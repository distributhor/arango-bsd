import debug from 'debug'
import { Database } from 'arangojs'
import { Config } from 'arangojs/connection'

const _debug = {
  errors: debug('guacamole:debug:error'),
  info: debug('guacamole:debug:info')
}

/** @internal */
interface EntityExists {
  name: string
  exists: boolean
}

/** @internal */
interface EntityAvailability {
  all: EntityExists[]
  missing: string[]
  existing: string[]
  allExist: boolean
}

export const enum DbClearanceMethod {
  DELETE_DATA = 'DELETE_DATA',
  RECREATE_DB = 'RECREATE_DB',
}

export interface DbStructure {
  collections: string[]
  graphs?: GraphDefinition[]
}

export interface GraphDefinition {
  name: string
  edges: EdgeDefinition[]
}

export interface EdgeDefinition {
  collection: string
  from: string
  to: string
}

export interface DbStructureComparison {
  database?: EntityExists
  collections?: EntityExists[]
  graphs?: EntityExists[]
  message?: string
}

export interface DbStructureResponse {
  database?: string
  collections?: string[]
  graphs?: string[]
  error?: any
}

/** @internal */
function isGraphDefinition(x: any): x is GraphDefinition {
  return x.name
}

/** @internal */
function isGraphDefinitionArray(x: any[]): x is GraphDefinition[] {
  return x.length > 0 && isGraphDefinition(x[0])
}

/** @internal */
function toGraphNames(graphs: string[] | GraphDefinition[]): string[] {
  if (graphs.length === 0) {
    return []
  }

  if (isGraphDefinitionArray(graphs)) {
    return graphs.map((g) => g.name)
  }

  return graphs
}

export class DbAdmin {
  /** @internal */
  db: Database

  /** @internal */
  system: Database

  constructor(db: Config | Database) {
    this.db = db instanceof Database ? db : new Database(db)
    this.system = this.db.database('_system')
  }

  public async clearDb(method: DbClearanceMethod = DbClearanceMethod.DELETE_DATA): Promise<void> {
    const exists = await this.db.exists()
    if (!exists) {
      return
    }

    if (method === DbClearanceMethod.RECREATE_DB) {
      try {
        await this.db.dropDatabase(this.db.name)
        await this.db.createDatabase(this.db.name)
        _debug.info(`DB ${this.db.name} re-created`)
        return
      } catch (e) {
        throw new Error(`Failed to re-create DB ${this.db.name}`)
      }
    }

    // TODO: graphs are not cleared yet ?

    (await this.db.collections()).map(async (collection) => await collection.truncate())
    _debug.info(`DB ${this.db.name} cleaned`)
  }

  public async compareDbStructure(structure: DbStructure): Promise<DbStructureComparison> {
    const response: DbStructureComparison = {
      message: undefined,
      database: undefined,
      collections: [],
      graphs: []
    }

    if (!structure?.collections) {
      return response
    }

    const exists = await this.db.exists()
    if (!exists) {
      response.message = 'Database does not exist'
      response.database = { name: this.db.name, exists: false }
      return response
    }

    response.database = { name: this.db.name, exists: true }

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

  public async createDbStructure(
    structure: DbStructure,
    clearDb?: DbClearanceMethod
  ): Promise<DbStructureResponse> {
    if (!structure?.collections) {
      throw new Error('No DB structure specified')
    }

    const response: DbStructureResponse = {
      database: undefined,
      collections: [],
      graphs: [],
      error: false
    }

    const exists = await this.db.exists()

    if (!exists) {
      _debug.info(`Database '${this.db.name}' not found`)

      try {
        await this.system.createDatabase(this.db.name)
        _debug.info(`Database '${this.db.name}' created`)
        response.database = 'Database created'
      } catch (e) {
        response.database = 'Failed to create database'
        response.error = e
        _debug.info(`Failed to create database '${this.db.name}'`)
        _debug.errors(e)
        return response
      }
    } else {
      if (clearDb) {
        await this.clearDb(clearDb)
        _debug.info(`Database '${this.db.name}' cleared with method ${clearDb}`)
        response.database = `Database cleared with method ${clearDb}`
      } else {
        _debug.info(`Database '${this.db.name}' found`)
        response.database = 'Database found'
      }
    }

    const comparison = await this.compareDbStructure(structure)

    if (comparison.collections) {
      if (!response.collections) {
        response.collections = []
      }

      for (const collection of comparison.collections) {
        if (!collection.exists) {
          try {
            await this.db.collection(collection.name).create()
            response.collections.push(`Collection '${collection.name}' created`)
          } catch (e) {
            response.collections.push(`Failed to create collection '${collection.name}'`)
            response.error = e
            _debug.errors(`Failed to create collection '${collection.name}'`)
            _debug.errors(e)
            return response
          }
        } else {
          response.collections.push(`Collection '${collection.name}' found`)
        }
      }
    }

    if (comparison.graphs) {
      if (!response.graphs) {
        response.graphs = []
      }

      for (const graph of comparison.graphs) {
        if (!graph.exists) {
          const definition = structure.graphs
            ? structure.graphs.filter(g => g.name === graph.name)[0]
            : undefined

          if (definition?.edges && definition.edges.length > 0) {
            try {
              await this.db.graph(graph.name).create(definition.edges)
              response.graphs.push(`Graph '${graph.name}' created`)
            } catch (e) {
              response.graphs.push(`Failed to create graph '${graph.name}'`)
              response.error = e
              _debug.errors(`Failed to create graph '${graph.name}'`)
              _debug.errors(e)
              return response
            }
          }
        } else {
          response.graphs.push(`Graph '${graph.name}' found`)
        }
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

    response.existing = (await this.db.listCollections()).map((c) => c.name)

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

    response.existing = (await this.db.listGraphs()).map((c) => c.name)

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

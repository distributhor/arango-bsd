/* eslint-disable @typescript-eslint/dot-notation */
import _clone from 'lodash.clonedeep'
import _omit from 'lodash.omit'

import { DbStructure } from '../../src/dbms'
import { ArangoConnection } from '../../src/index'
import { GraphRelation, QueryResult } from '../../src/types'

import { VAR } from './jest.shared'

import cyclists from './data/cyclists.json'
import teams from './data/teams.json'
import races from './data/races.json'

const cyclistsWithoutRaceData: any = [] // _clone(cyclists)
const cyclistsWithRaceData = {}

for (const cyclist of cyclists) {
  if (!cyclistsWithRaceData[`${cyclist.name} ${cyclist.surname}`]) {
    cyclistsWithRaceData[`${cyclist.name} ${cyclist.surname}`] = cyclist
  }

  const cloned = _clone(cyclist)
  const c = _omit(cloned, 'races')

  c.results = {}

  if (cyclist.races) {
    c.results.list = cyclist.races.map(r => `${r.year}, ${r.race}, ${r.position}`)
    c.results.year = {}

    for (const r of cyclist.races) {
      if (!c.results.year[r.year]) {
        c.results.year[r.year] = []
      }

      c.results.year[r.year].push(`${r.position}, ${r.race}`)
    }

    if (c.results.list) {
      c.results.palmares = c.results.list.join('; ')
    }
  }

  cyclistsWithoutRaceData.push(c)
}

const teamsWithoutMemberData = teams.map(t => { return { name: t.name } })
const teamsWithMemberData = {}

for (const t of teams) {
  if (!teamsWithMemberData[t.name]) {
    teamsWithMemberData[t.name] = t
  }
}

const dbStructure: DbStructure = {
  collections: [
    VAR.cyclistCollection,
    VAR.teamCollection,
    VAR.raceCollection,
    VAR.altCyclistCollection
  ],
  graphs: [
    {
      name: VAR.teamMembershipGraph,
      edges: [
        {
          collection: VAR.teamMembershipEdge,
          from: VAR.cyclistCollection,
          to: VAR.teamCollection
        }
      ]
    },
    {
      name: VAR.raceAttendanceGraph,
      edges: [
        {
          collection: VAR.raceAttendanceEdge,
          from: VAR.raceCollection,
          to: VAR.cyclistCollection
        }
      ]
    }
  ]
}

const conn = new ArangoConnection([{
  databaseName: VAR.dbName,
  url: VAR.dbUrl,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}], { printQueries: false, debugFilters: false })

// TODO: want to use a different restricted user for some tests in the future
// const dbRestrictedUser = dbAdminUser // 'guacamole'
// const dbRestrictePassword = dbAdminPassword // 'letmein'

describe('Guacamole Integration Tests', () => {
  test('Connection and instance management', async () => {
    expect(conn.db(VAR.dbName).dbName).toEqual(VAR.dbName)
    expect(conn.listConnections()).toEqual([VAR.dbName])

    conn.db(VAR.dbName) // should NOT create additional instance, because it already exists
    conn.db(VAR.dbName2) // should create an additional instance, because it doesn't exist

    expect(conn.db(VAR.dbName).dbName).toEqual(VAR.dbName)
    expect(conn.db(VAR.dbName2).dbName).toEqual(VAR.dbName2)
    expect(conn.listConnections()).toEqual([VAR.dbName, VAR.dbName2])
  })

  test('Create database', async () => {
    const db1AlreadyExists = await conn.db(VAR.dbName).dbExists()
    const db2AlreadyExists = await conn.db(VAR.dbName2).dbExists()

    if (db1AlreadyExists) {
      await conn.system.dropDatabase(VAR.dbName)
    }

    if (db2AlreadyExists) {
      await conn.system.dropDatabase(VAR.dbName2)
    }

    // confirm that at least one database is already present
    const dbs = await conn.system.listDatabases()
    expect(dbs.length).toBeGreaterThanOrEqual(1)

    let db1Exists = await conn.db(VAR.dbName).dbExists()
    let db2Exists = await conn.db(VAR.dbName2).dbExists()

    expect(db1Exists).toBeFalsy()
    expect(db2Exists).toBeFalsy()

    await conn.system.createDatabase(VAR.dbName)

    db1Exists = await conn.db(VAR.dbName).dbExists()
    db2Exists = await conn.db(VAR.dbName2).dbExists()

    expect(db1Exists).toBeTruthy()
    expect(db2Exists).toBeFalsy()
  })

  test('Create database structure and test multi-driver behaviour', async () => {
    // create structure for existing DB
    const result1 = await conn.db(VAR.dbName).manage.createDbStructure(dbStructure)

    // create structure for non-existing DB
    const result2 = await conn.db(VAR.dbName2).manage.createDbStructure(dbStructure)

    expect(result1.database).toEqual('Database found')
    expect(result1.graphs).toEqual(expect.arrayContaining([`Graph '${VAR.teamMembershipGraph}' created`]))
    expect(result1.collections).toEqual(
      expect.arrayContaining([
        `Collection '${VAR.cyclistCollection}' created`,
        `Collection '${VAR.teamCollection}' created`
      ])
    )

    // TODO: confirm that removal and re-creation of collection doesn't affect dependent graph ?
    expect(result2.database).toEqual('Database created')
    expect(result2.graphs).toEqual(expect.arrayContaining([`Graph '${VAR.teamMembershipGraph}' created`]))
    expect(result2.collections).toEqual(
      expect.arrayContaining([
        `Collection '${VAR.cyclistCollection}' created`,
        `Collection '${VAR.teamCollection}' created`
      ])
    )

    // confirm non-existent DB was created
    const db2Exists = await conn.db(VAR.dbName2).dbExists()
    expect(db2Exists).toBeTruthy()

    // check that expected collections exist and that different drivers behave as expected
    const collecionList1 = await conn.driver(VAR.dbName).listCollections()
    const collecionList2 = await conn.driver(VAR.dbName2).listCollections()

    expect(collecionList1.length).toEqual(6)
    expect(collecionList2.length).toEqual(6)

    const usersCollectionOnSystemDB1 = await conn.system.collection(VAR.cyclistCollection).exists()

    const usersCollectionExist = await conn.db(VAR.dbName).collection(VAR.cyclistCollection).exists()
    const groupsCollectionExist = await conn.db(VAR.dbName).collection(VAR.teamCollection).exists()
    const userGroupsCollectionExist = await conn.db(VAR.dbName).collection(VAR.teamMembershipEdge).exists()

    expect(usersCollectionOnSystemDB1).toBeFalsy()
    expect(usersCollectionExist).toBeTruthy()
    expect(groupsCollectionExist).toBeTruthy()
    expect(userGroupsCollectionExist).toBeTruthy()

    // remove a collection and recreate the structure
    // await conn.driver(VAR.dbName2).graph(VAR.teamMembershipGraph).drop()
    await conn.driver(VAR.dbName2).graph(VAR.raceAttendanceGraph).removeEdgeDefinition(VAR.raceAttendanceEdge)
    await conn.driver(VAR.dbName2).graph(VAR.raceAttendanceGraph).removeVertexCollection(VAR.cyclistCollection)

    await conn.driver(VAR.dbName2).graph(VAR.teamMembershipGraph).removeEdgeDefinition(VAR.teamMembershipEdge)
    await conn.driver(VAR.dbName2).graph(VAR.teamMembershipGraph).removeVertexCollection(VAR.cyclistCollection)

    await conn.driver(VAR.dbName2).collection(VAR.cyclistCollection).drop()
    const usersCollectionExist2 = await conn.db(VAR.dbName2).collection(VAR.cyclistCollection).exists()
    expect(usersCollectionExist2).toBeFalsy()

    const result3 = await conn.db(VAR.dbName2).manage.createDbStructure(dbStructure)

    expect(result3.database).toEqual('Database found')
    expect(result3.graphs).toEqual(expect.arrayContaining([`Graph '${VAR.teamMembershipGraph}' found`]))
    expect(result3.collections).toEqual(
      expect.arrayContaining([
        `Collection '${VAR.cyclistCollection}' created`,
        `Collection '${VAR.teamCollection}' found`
      ])
    )

    const usersCollectionExist3 = await conn.db(VAR.dbName2).collection(VAR.cyclistCollection).exists()
    expect(usersCollectionExist3).toBeTruthy()

    // confirm that empty array values do not break anything, ie, that they
    // are essentially unhandled and nothing happens, so it's a safe operation
    const dbStructureWithEmptyArrays: DbStructure = {
      collections: [],
      graphs: [
        {
          name: 'xyz',
          edges: []
        }
      ]
    }

    const result4 = await conn.db(VAR.dbName2).manage.createDbStructure(dbStructureWithEmptyArrays)

    const collectionLength = result4.collections ? result4.collections.length : 99
    const graphLength = result4.graphs ? result4.graphs.length : 99

    expect(result4.database).toEqual('Database found')
    expect(collectionLength).toEqual(0)
    expect(graphLength).toEqual(0)
  })

  test('Validate database structure', async () => {
    if (dbStructure.collections) {
      dbStructure.collections.push('abc')
    }

    if (dbStructure.graphs) {
      dbStructure.graphs.push({
        name: 'def',
        edges: []
      })
    }

    const result = await conn.db(VAR.dbName).manage.compareDbStructure(dbStructure)

    expect(result.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: VAR.cyclistCollection, exists: true }),
        expect.objectContaining({ name: VAR.teamCollection, exists: true }),
        expect.objectContaining({ name: 'abc', exists: false })
      ])
    )

    expect(result.graphs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: VAR.teamMembershipGraph, exists: true }),
        expect.objectContaining({ name: 'def', exists: false })
      ])
    )
  })

  test('Import test data', async () => {
    const result1 = await conn.db(VAR.dbName).create(VAR.cyclistCollection, cyclistsWithoutRaceData)
    const result2 = await conn.db(VAR.dbName).create(VAR.teamCollection, teamsWithoutMemberData)
    const result3 = await conn.db(VAR.dbName).create(VAR.raceCollection, races)
    const result4 = await conn.db(VAR.dbName).driver.collection(VAR.altCyclistCollection).import(cyclists)

    expect(result1.length).toEqual(31)
    expect(result2.length).toEqual(19)
    expect(result3.length).toEqual(29)
    expect(result4.created).toEqual(31)

    expect(result1[0]._key).toBeDefined()

    const allCyclists = await conn.db(VAR.dbName).fetchAll(VAR.cyclistCollection) as QueryResult
    const allTeams = await conn.db(VAR.dbName).fetchAll(VAR.teamCollection) as QueryResult
    const allRaces = await conn.db(VAR.dbName).fetchAll(VAR.raceCollection) as QueryResult

    const cyclistsByName = {}
    const teamsByName = {}
    const racesByName = {}

    for (const cyclist of allCyclists.data) {
      cyclistsByName[`${cyclist.name} ${cyclist.surname}`] = cyclist
    }

    for (const team of allTeams.data) {
      teamsByName[`${team.name}`] = team
    }

    for (const race of allRaces.data) {
      racesByName[`${race.name}`] = race
    }

    for (const team of allTeams.data) {
      const t = teamsWithMemberData[team.name]
      if (t?.members) {
        const teamRelations: GraphRelation[] = []

        for (const member of t.members) {
          if (cyclistsByName[member.name]) {
            teamRelations.push({
              from: `${VAR.cyclistCollection}/${cyclistsByName[member.name]._key}`,
              to: `${VAR.teamCollection}/${team._key}`,
              data: {
                from: member.from,
                to: member.to
              }
            })
          }
        }

        await conn.db(VAR.dbName).createEdgeRelation(VAR.teamMembershipEdge, teamRelations)
      }
    }

    for (const race of allRaces.data) {
      const attendanceRelations: GraphRelation[] = []

      for (const cyclist of allCyclists.data) {
        const c = cyclistsWithRaceData[`${cyclist.name} ${cyclist.surname}`]
        if (c.races) {
          for (const r of c.races) {
            if (r.race === race.name && racesByName[r.race] && cyclistsByName[`${cyclist.name} ${cyclist.surname}`]) {
              attendanceRelations.push({
                from: `${VAR.raceCollection}/${race._key}`,
                to: `${VAR.cyclistCollection}/${cyclistsByName[`${cyclist.name} ${cyclist.surname}`]._key}`,
                data: {
                  year: r.year,
                  position: r.position,
                  result: r.result
                }
              })
            }
          }
        }
      }

      await conn.db(VAR.dbName).createEdgeRelation(VAR.raceAttendanceEdge, attendanceRelations)
    }
  })
})

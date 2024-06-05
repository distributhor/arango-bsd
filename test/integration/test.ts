/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable jest/no-conditional-expect */
import * as path from 'path'
import * as dotenv from 'dotenv'
import { aql } from 'arangojs/aql'
import { ArrayCursor } from 'arangojs/cursor'
import { ArangoConnection, ArangoDBWithoutGarnish } from '../../src/index'
import { DbStructure, GraphRelation, MatchType, QueryResult } from '../../src/types'

import cyclists from './cyclists.json'
import teams from './teams.json'

for (const c of cyclists) {
  if (c.results?.detail) {
    c.results['list'] = c.results.detail.map(r => `${r.year}, ${r.race}, ${r.position}`)

    c.results['year'] = {}

    for (const r of c.results.detail) {
      if (!c.results['year'][r.year]) {
        c.results['year'][r.year] = []
      }

      c.results['year'][r.year].push(`${r.position}, ${r.race}`)
    }

    if (c.results['list']) {
      c['palmares'] = c.results['list'].join('; ')
    }
  }
}

dotenv.config({ path: path.join(__dirname, '.env') })

const db1 = 'guacamole_test'
const db2 = 'guacamole_test2'

const dbAdminUser = process.env.GUACAMOLE_TEST_DB_USER ?? 'root'
const dbAdminPassword = process.env.GUACAMOLE_TEST_DB_PASSWORD ?? 'letmein'

// TODO: want to use a different restricted user for some tests in the future
// const dbRestrictedUser = dbAdminUser // 'guacamole'
// const dbRestrictePassword = dbAdminPassword // 'letmein'

const CONST = {
  userCollection: 'cyclists',
  groupCollection: 'teams',
  userToGroupEdge: 'team_members',
  groupMembershipGraph: 'team_membership'
}

const dbStructure: DbStructure = {
  collections: [CONST.userCollection, CONST.groupCollection],
  graphs: [
    {
      graph: CONST.groupMembershipGraph,
      edges: [
        {
          collection: CONST.userToGroupEdge,
          from: CONST.userCollection,
          to: CONST.groupCollection
        }
      ]
    }
  ]
}

const conn = new ArangoConnection([{
  databaseName: db1,
  url: process.env.GUACAMOLE_TEST_DB_URI,
  auth: { username: dbAdminUser, password: dbAdminPassword }
}], { printQueries: false, debugFilters: false })

const db = new ArangoDBWithoutGarnish({
  databaseName: db1,
  url: process.env.GUACAMOLE_TEST_DB_URI,
  auth: { username: dbAdminUser, password: dbAdminPassword }
}, { printQueries: false })

describe('Guacamole Integration Tests', () => {
  test('Connection and instance management', async () => {
    expect(conn.db(db1).name).toEqual(db1)
    expect(conn.listConnections()).toEqual([db1])

    conn.db(db1) // should NOT create additional instance, because it already exists
    conn.db(db2) // should create an additional instance, because it doesn't exist

    expect(conn.db(db1).name).toEqual(db1)
    expect(conn.db(db2).name).toEqual(db2)
    expect(conn.listConnections()).toEqual([db1, db2])
  })

  test('Create database', async () => {
    const db1AlreadyExists = await conn.db(db1).dbExists()
    const db2AlreadyExists = await conn.db(db2).dbExists()

    if (db1AlreadyExists) {
      await conn.system.dropDatabase(db1)
    }

    if (db2AlreadyExists) {
      await conn.system.dropDatabase(db2)
    }

    // confirm that at least one database is already present
    const dbs = await conn.system.listDatabases()
    expect(dbs.length).toBeGreaterThanOrEqual(1)

    let db1Exists = await conn.db(db1).dbExists()
    let db2Exists = await conn.db(db2).dbExists()

    expect(db1Exists).toBeFalsy()
    expect(db2Exists).toBeFalsy()

    await conn.system.createDatabase(db1)

    db1Exists = await conn.db(db1).dbExists()
    db2Exists = await conn.db(db2).dbExists()

    expect(db1Exists).toBeTruthy()
    expect(db2Exists).toBeFalsy()
  })

  test('Create database structure and test multi-driver behaviour', async () => {
    // create structure for existing DB
    const result1 = await conn.db(db1).createDbStructure(dbStructure)

    // create structure for non-existing DB
    const result2 = await conn.db(db2).createDbStructure(dbStructure)

    expect(result1.database).toEqual('Database found')
    expect(result1.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' created`]))
    expect(result1.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' created`
      ])
    )

    // TODO: confirm that removal and re-creation of collection doesn't affect dependent graph ?
    expect(result2.database).toEqual('Database created')
    expect(result2.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' created`]))
    expect(result2.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' created`
      ])
    )

    // confirm non-existent DB was created
    const db2Exists = await conn.db(db2).dbExists()
    expect(db2Exists).toBeTruthy()

    // check that expected collections exist and that different drivers behave as expected
    const collecionList1 = await conn.driver(db1).listCollections()
    const collecionList2 = await conn.driver(db2).listCollections()

    expect(collecionList1.length).toEqual(3)
    expect(collecionList2.length).toEqual(3)

    const usersCollectionOnSystemDB1 = await conn.system.collection(CONST.userCollection).exists()

    const usersCollectionExist = await conn.db(db1).collection(CONST.userCollection).exists()
    const groupsCollectionExist = await conn.db(db1).collection(CONST.groupCollection).exists()
    const userGroupsCollectionExist = await conn.db(db1).collection(CONST.userToGroupEdge).exists()

    expect(usersCollectionOnSystemDB1).toBeFalsy()
    expect(usersCollectionExist).toBeTruthy()
    expect(groupsCollectionExist).toBeTruthy()
    expect(userGroupsCollectionExist).toBeTruthy()

    // remove a collection and recreate the structure
    // await conn.driver(db2).graph(CONST.groupMembershipGraph).drop()
    await conn.driver(db2).graph(CONST.groupMembershipGraph).removeEdgeDefinition(CONST.userToGroupEdge)
    await conn.driver(db2).graph(CONST.groupMembershipGraph).removeVertexCollection(CONST.userCollection)
    await conn.driver(db2).collection(CONST.userCollection).drop()
    const usersCollectionExist2 = await conn.db(db2).collection(CONST.userCollection).exists()
    expect(usersCollectionExist2).toBeFalsy()

    const result3 = await conn.db(db2).createDbStructure(dbStructure)

    expect(result3.database).toEqual('Database found')
    expect(result3.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' found`]))
    expect(result3.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' found`
      ])
    )

    const usersCollectionExist3 = await conn.db(db2).collection(CONST.userCollection).exists()
    expect(usersCollectionExist3).toBeTruthy()

    // confirm that empty array values do not break anything, ie, that they
    // are essentially unhandled and nothing happens, so it's a safe operation
    const dbStructureWithEmptyArrays: DbStructure = {
      collections: [],
      graphs: [
        {
          graph: 'xyz',
          edges: []
        }
      ]
    }

    const result4 = await conn.db(db2).createDbStructure(dbStructureWithEmptyArrays)

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
        graph: 'def',
        edges: []
      })
    }

    const result = await conn.db(db1).validateDbStructure(dbStructure)

    expect(result.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: CONST.userCollection, exists: true }),
        expect.objectContaining({ name: CONST.groupCollection, exists: true }),
        expect.objectContaining({ name: 'abc', exists: false })
      ])
    )

    expect(result.graphs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: CONST.groupMembershipGraph, exists: true }),
        expect.objectContaining({ name: 'def', exists: false })
      ])
    )
  })

  test('Import test data', async () => {
    const result1 = await conn.db(db1).create(CONST.userCollection, cyclists)
    const result2 = await conn.db(db1).create(CONST.groupCollection, teams)

    expect(result1.length).toEqual(31)
    expect(result2.length).toEqual(19)

    const allCyclists = await conn.db(db1).fetchAll(CONST.userCollection) as QueryResult
    const allTeams = await conn.db(db1).fetchAll(CONST.groupCollection) as QueryResult

    const cyclistsByName = {}

    for (const cyclist of allCyclists.data) {
      cyclistsByName[`${cyclist.name} ${cyclist.surname}`] = cyclist
    }

    for (const team of allTeams.data) {
      if (team.members) {
        const teamRelations: GraphRelation[] = []

        for (const member of team.members) {
          if (cyclistsByName[member.name]) {
            teamRelations.push({
              from: `${CONST.userCollection}/${cyclistsByName[member.name]._key}`,
              to: `${CONST.groupCollection}/${team._key}`,
              data: {
                from: member.from,
                to: member.to
              }
            })
          }
        }

        await conn.db(db1).createEdgeRelation(CONST.userToGroupEdge, teamRelations)
      }
    }
  })

  test('Unique constraint validation', async () => {
    // should be case insensitive PT1
    // FOR d IN @@value0 FILTER ( LOWER(d.@value1) == @value2 ) RETURN d._key
    // bindVars: { '@value0': 'cyclists', value1: 'trademark', value2: 'Live Strong' }
    const result1 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'livestrong'
        }
      })

    expect(result1.violatesUniqueConstraint).toBeTruthy()

    // should be case insensitive PT2
    const result1DifferentCase1 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'LIVESTRONG'
        }
      })

    expect(result1DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    // should be case sensitive
    const result1DifferentCase2 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'LiveStrong', caseSensitive: true
        }
      })

    expect(result1DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result2 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'Yellow'
        }
      })

    expect(result2.violatesUniqueConstraint).toBeFalsy()

    // FOR d IN @@value0 FILTER ( LOWER(d.@value1) == @value2 || LOWER(d.@value3) == @value4 ) RETURN d._key
    // bindVars: {
    //     value1: 'trademark',
    //     value2: 'tornado',
    //     value3: 'surname',
    //     value4: 'armstrong'
    // }
    const result3 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'Armstrong' }
        ]
      })

    expect(result3.violatesUniqueConstraint).toBeTruthy()

    const result3DifferentCase1 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'ArmSTRONG' }
        ]
      })

    expect(result3DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    const result3DifferentCase2 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'TORNADO', caseSensitive: true },
          { property: 'surname', value: 'ArmSTRONG', caseSensitive: true }
        ]
      })

    expect(result3DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result4 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result4.violatesUniqueConstraint).toBeFalsy()

    // FOR d IN @@value0 FILTER ( LOWER(d.@value1) == @value2 && LOWER(d.@value3) == @value4 ) RETURN d._key
    // bindVars: {
    //     value1: 'trademark',
    //     value2: 'tornado',
    //     value3: 'surname',
    //     value4: 'voeckler'
    // }
    const result5 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        composite: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result5.violatesUniqueConstraint).toBeFalsy()

    const result5DifferentCase1 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'DE Gendt' }
        ]
      })

    expect(result5DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    const result5DifferentCase2 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        composite: [
          { property: 'name', value: 'THOMAS', caseSensitive: true },
          { property: 'surname', value: 'DE Gendt', caseSensitive: true }
        ]
      })

    expect(result5DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result6 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        composite: [
          { property: 'name', value: 'Thomas' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result6.violatesUniqueConstraint).toBeFalsy()

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 && LOWER(d.@value3) == @value4 ) || LOWER(d.@value5) == @value6 ) RETURN d._key
    // bindVars: {
    //     value1: 'name',
    //     value2: 'thomas',
    //     value3: 'surname',
    //     value4: 'de gendt',
    //     value5: 'trademark',
    //     value6: 'tornado'
    // }
    const result7 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'Yellow'
        },
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'DE Gendt' }
        ]
      })

    expect(result7.violatesUniqueConstraint).toBeTruthy()

    const result8 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'Yellow'
        },
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result8.violatesUniqueConstraint).toBeFalsy()

    const result9 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: {
          property: 'trademark', value: 'Wish I Was 3kg Lighter'
        },
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result9.violatesUniqueConstraint).toBeTruthy()

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 && LOWER(d.@value3) == @value4 ) || LOWER(d.@value5) == @value6 || LOWER(d.@value5) == @value7 ) RETURN d._key
    // bindVars: {
    //     value1: 'name',
    //     value2: 'thomas',
    //     value3: 'surname',
    //     value4: 'voeckler',
    //     value5: 'trademark',
    //     value6: 'wish i was 3kg lighter',
    //     value7: 'tornado'
    // }
    const result10 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Wish I Was 3kg Lighter' },
          { property: 'trademark', value: 'Yellow' }
        ],
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result10.violatesUniqueConstraint).toBeTruthy()

    const result11 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Wish I Was 5kg Lighter' },
          { property: 'trademark', value: 'Yellow' }
        ],
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result11.violatesUniqueConstraint).toBeFalsy()

    const result12 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Wish I Was 5kg Lighter' },
          { property: 'trademark', value: 'Yellow' }
        ],
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'DE Gendt' }
        ]
      })

    expect(result12.violatesUniqueConstraint).toBeTruthy()

    const thomas = await conn.db(db1).fetchOneByPropertyValue(
      CONST.userCollection,
      { property: 'surname', value: 'de Gendt' }
    )

    // FOR d IN @@value0 FILTER (d._key != @value1) FILTER (
    //   ( LOWER(d.@value2) == @value3 && LOWER(d.@value4) == @value5 ) || LOWER(d.@value6) == @value7 || LOWER(d.@value6) == @value8
    // ) RETURN d._key
    const result13 = await conn.db(db1).validateUniqueConstraint(
      CONST.userCollection,
      {
        singular: [
          { property: 'trademark', value: 'Wish I Was 5kg Lighter' },
          { property: 'trademark', value: 'Yellow' }
        ],
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'DE Gendt' }
        ],
        excludeDocumentKey: thomas._key
      })

    expect(result13.violatesUniqueConstraint).toBeFalsy()
  })

  test('CRUD', async () => {
    expect.assertions(184)

    const result1A = await conn.db(db1).create(CONST.userCollection, {
      name: 'Daryl',
      surname: 'Impey',
      country: 'South Africa',
      strength: 'All Rounder',
      _secret: 'Rusks',
      year: {
        2014: ['1st, Tour of Alberta', '1st, SA Champs TT', '2nd, SA Champs Road Race'],
        2015: ['2nd, Vuelta a La Rioja'],
        2017: ['1st, 94.7 Cycle Challenge'],
        2018: ['1st, SA Champs TT', '1st, SA Champs Road Race', '1st, Tour Down Under']
      },
      rating: {
        sprint: 8,
        climb: 7,
        timetrial: 8,
        punch: 8,
        descend: 7
      },
      favoriteRoads: {
        SouthAfrica: {
          CapeTown: 'Chapmans Peak'
        },
        Portugal: {
          Lisbon: 'Sintra'
        },
        France: 'Col du Galibier'
      }
    })

    expect(result1A).toBeDefined()
    expect(result1A[0]._key).toBeDefined()

    const result1B = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })

    expect(result1B.name).toEqual('Daryl')
    expect(result1B.surname).toEqual('Impey')
    expect(result1B._secret).toEqual('Rusks')
    expect(result1B.year[2018].length).toEqual(3)
    expect(result1B.rating.timetrial).toEqual(8)

    // interface Person {
    //   name: string
    // }
    // const result1C = await conn.db(db1).read<Person>(

    const result1C = await conn.db(db1).read(CONST.userCollection, result1A[0]._key, {
      trimPrivateProps: true
    })

    expect(result1C.name).toEqual('Daryl')
    expect(result1C.surname).toEqual('Impey')
    expect(result1C._secret).toBeUndefined()
    expect(result1C.year[2018].length).toEqual(3)
    expect(result1C.rating.timetrial).toEqual(8)

    const result1D = await conn.db(db1).read(CONST.userCollection, { value: 'Impey', property: 'surname' })

    expect(result1D.name).toEqual('Daryl')
    expect(result1D.surname).toEqual('Impey')
    expect(result1D._secret).toEqual('Rusks')
    expect(result1D.year[2018].length).toEqual(3)
    expect(result1D.rating.timetrial).toEqual(8)

    const result1E = await conn.db(db1).read(CONST.userCollection, { value: 'Impey', property: 'surname' }, {
      trimPrivateProps: true
    })

    expect(result1E.name).toEqual('Daryl')
    expect(result1E.surname).toEqual('Impey')
    expect(result1E._secret).toBeUndefined()
    expect(result1E.year[2018].length).toEqual(3)
    expect(result1E.rating.timetrial).toEqual(8)

    const result1F = await conn.db(db1).read(CONST.userCollection, result1A[0]._key)

    expect(result1F.name).toEqual('Daryl')
    expect(result1F.surname).toEqual('Impey')
    expect(result1F.year[2017].length).toEqual(1)
    expect(result1F.year[2018].length).toEqual(3)

    const result1GA = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'year.2017')
    expect(Array.isArray(result1GA)).toBeTruthy()
    expect(result1GA.length).toEqual(1)

    const result1GB = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'year.2018')
    expect(Array.isArray(result1GB)).toBeTruthy()
    expect(result1GB.length).toEqual(3)

    const result1GC = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'country')
    expect(result1GC).toEqual('South Africa')

    const result1GD = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'favoriteRoads')
    expect(result1GD).toBeDefined()
    expect(result1GD.SouthAfrica).toBeDefined()

    const result1GE = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'blah')
    expect(result1GE).toBeUndefined()

    const result1HA = await conn.db(db1).addArrayValue(CONST.userCollection, result1A[0]._key, 'blah', 'one')
    const result1HB = await conn.db(db1).addArrayValue(CONST.userCollection, result1A[0]._key, 'blah', 2)
    const result1HC = await conn.db(db1).addArrayValue(CONST.userCollection, result1A[0]._key, 'nested.blah', 'one')
    const result1HD = await conn.db(db1).addArrayValue(CONST.userCollection, result1A[0]._key, 'nested.blah', 2)

    try {
      await conn.db(db1).addArrayValue(CONST.userCollection, result1A[0]._key, 'country', 'Australia')
    } catch (e) {
      expect(e.message).toEqual('Cannot add array value to an existing field that is not already of type array')
    }

    expect(result1HA[0].blah).toBeDefined()
    expect(result1HB[0].blah).toBeDefined()
    expect(result1HC[0].nested).toBeDefined()
    expect(result1HD[0].nested).toBeDefined()

    const result1J = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })
    expect(result1J.blah.length).toBe(2)
    expect(result1J.blah[0]).toBe('one')
    expect(result1J.nested.blah.length).toBe(2)
    expect(result1J.nested.blah[1]).toBe(2)

    const result1KA = await conn.db(db1).removeArrayValue(CONST.userCollection, result1A[0]._key, 'blah', 'one')
    const result1KB = await conn.db(db1).removeArrayValue(CONST.userCollection, result1A[0]._key, 'nested.blah', 2)
    const result1KC = await conn.db(db1).removeArrayValue(CONST.userCollection, result1A[0]._key, 'bleh', 'one')

    try {
      await conn.db(db1).removeArrayValue(CONST.userCollection, result1A[0]._key, 'country', 'South Africa')
    } catch (e) {
      expect(e.message).toEqual('Cannot remove array value from an existing field that is not already of type array')
    }

    expect(result1KA).not.toBeNull()
    expect(result1KB).not.toBeNull()
    expect(result1KC).toBeNull()

    const result1L = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })
    expect(result1L.blah.length).toBe(1)
    expect(result1L.blah[0]).toBe(2)
    expect(result1L.nested.blah.length).toBe(1)
    expect(result1L.nested.blah[0]).toBe('one')
    expect(result1L.bleh).toBeUndefined()
    expect(result1L.country).toBe('South Africa')

    const result1MA = await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', { id: 'a', val: 'one' }, 'id')
    const result1MB = await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', { id: 'b', val: 2 }, 'id')
    const result1MC = await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', { id: 'a', val: 'one' }, 'id')
    const result1MD = await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', { id: 'b', val: 2 }, 'id')

    // add an array object without specifying a unique object field, should result in the object being added,
    // even though there is an existing object with the same id
    const result1ME = await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', { id: 'b', val: '3.0' })

    expect(result1MA).not.toBeNull()
    expect(result1MB).not.toBeNull()
    expect(result1MC).not.toBeNull()
    expect(result1MD).not.toBeNull()
    expect(result1ME).not.toBeNull()

    try {
      await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', { id: 'a', val: 'three' }, 'idz')
    } catch (e) {
      expect(e.message).toEqual("The array object must be unique, no 'uniqueObjectField' was provided, or the array object is missing that field")
    }

    try {
      await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', { idz: 'a', val: 'three' }, 'id')
    } catch (e) {
      expect(e.message).toEqual("The array object must be unique, no 'uniqueObjectField' was provided, or the array object is missing that field")
    }

    try {
      await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', { id: 'b', val: 'three' }, 'id')
    } catch (e) {
      expect(e.message).toEqual('The array object being added is not unique')
    }

    try {
      await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', { id: 'a', val: 3 }, 'id')
    } catch (e) {
      expect(e.message).toEqual('The array object being added is not unique')
    }

    try {
      await conn.db(db1).addArrayObject(CONST.userCollection, result1A[0]._key, 'country', { id: 'z', val: 'Australia' }, 'id')
    } catch (e) {
      expect(e.message).toEqual('Cannot add array value to an existing field that is not already of type array')
    }

    const result1N = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })

    expect(result1N.oblah.length).toEqual(3)
    expect(result1N.nested.oblah.length).toEqual(2)

    const result1PA = await conn.db(db1).removeArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', 'id', 'b')
    const result1PB = await conn.db(db1).removeArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', 'id', 'a')
    const result1PC = await conn.db(db1).removeArrayObject(CONST.userCollection, result1A[0]._key, 'blah', 'idz', 'a')
    const result1PD = await conn.db(db1).removeArrayObject(CONST.userCollection, result1A[0]._key, 'blah', 'id', 'c')
    const result1PF = await conn.db(db1).removeArrayObject(CONST.userCollection, result1A[0]._key, 'bleh', 'id', 'a')

    expect(result1PA).not.toBeNull()
    expect(result1PB).not.toBeNull()
    expect(result1PC).toBeNull()
    expect(result1PD).toBeNull()
    expect(result1PF).toBeNull()

    try {
      await conn.db(db1).removeArrayObject(CONST.userCollection, result1A[0]._key, 'country', 'id', 'a')
    } catch (e) {
      expect(e.message).toEqual('Cannot remove array value from an existing field that is not already of type array')
    }

    const result1Q = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })

    expect(result1Q.oblah.length).toEqual(1)
    expect(result1Q.oblah[0].id).toEqual('a')
    expect(result1Q.oblah[0].val).toEqual('one')
    expect(result1Q.nested.oblah.length).toEqual(1)
    expect(result1Q.nested.oblah[0].id).toEqual('b')
    expect(result1Q.nested.oblah[0].val).toEqual(2)

    const result1RA = await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', 'id', 'a', {
      val: 'AAA'
    })

    const result1RB = await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', 'id', 'b', {
      val: 33
    })

    expect(result1RA).not.toBeNull()
    expect(result1RB).not.toBeNull()

    const result1RC = await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'foo', 'id', 'a', {
      val: 'XYZ'
    })

    const result1RE = await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', 'id', 'x', {
      val: 'ZZZ'
    })

    expect(result1RC).toBeNull()
    expect(result1RE).toBeNull()

    const result1S = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })

    expect(result1S.foo).toBeUndefined()
    expect(result1S.oblah.length).toEqual(1)
    expect(result1S.oblah[0].id).toEqual('a')
    expect(result1S.oblah[0].val).toEqual('AAA')
    expect(result1S.oblah[0].message).toBeUndefined()
    expect(result1S.nested.oblah.length).toEqual(1)
    expect(result1S.nested.oblah[0].id).toEqual('b')
    expect(result1S.nested.oblah[0].val).toEqual(33)

    const result1TA = await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'foo', 'id', 'a', {
      val: 'XYZ'
    }, { addIfNotFound: true })

    const result1TB = await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', 'id', 'x', {
      id: 'x',
      val: 'ZZZ'
    }, { addIfNotFound: true })

    expect(result1TA).not.toBeNull()
    expect(result1TB).not.toBeNull()

    // confirm the merging of objects work
    await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'oblah', 'id', 'a', {
      message: 'Hello World'
    })

    // confirm that replacing an entire array object works
    await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', 'id', 'b', {
      message: 'Replaced'
    }, { strategy: 'replace' })

    try {
      await conn.db(db1).updateArrayObject(CONST.userCollection, result1A[0]._key, 'country', 'id', 'a', {
        val: 'Australia'
      })
    } catch (e) {
      expect(e.message).toEqual('Cannot update array value from an existing field that is not already of type array')
    }

    const result1U = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })

    expect(result1U.foo).toBeDefined()
    expect(result1U.foo[0].id).toEqual('a')
    expect(result1U.foo[0].val).toEqual('XYZ')
    expect(result1U.oblah.length).toEqual(2)
    expect(result1U.oblah[0].id).toEqual('a')
    expect(result1U.oblah[0].val).toEqual('AAA')
    expect(result1U.oblah[0].message).toEqual('Hello World')
    expect(result1U.oblah[1].id).toEqual('x')
    expect(result1U.oblah[1].val).toEqual('ZZZ')
    expect(result1U.nested.oblah.length).toEqual(1)
    expect(result1U.nested.oblah[0].id).toEqual('b')
    expect(result1U.nested.oblah[0].val).toBeUndefined()
    expect(result1U.nested.oblah[0].message).toEqual('Replaced')

    // confirm that replacing an entire array object works
    await conn.db(db1).replaceArrayObject(CONST.userCollection, result1A[0]._key, 'nested.oblah', 'id', 'b', {
      msg: 'Replaced Again!',
      val: 'BLAH'
    })

    await conn.db(db1).replaceArray(CONST.userCollection, result1A[0]._key, 'blah', ['one', 'two', 'three'])
    await conn.db(db1).replaceArray(CONST.userCollection, result1A[0]._key, 'oblah', [{
      id: 123,
      text: '123'
    }, {
      id: 'ABC',
      text: 321
    }])

    const result1Z = await conn.db(db1).read(CONST.userCollection, { value: result1A[0]._key })

    // console.log(result1Z)

    expect(result1Z.blah.length).toEqual(3)
    expect(result1Z.blah[0]).toEqual('one')
    expect(result1Z.oblah.length).toEqual(2)
    expect(result1Z.oblah[0].id).toEqual(123)
    expect(result1Z.oblah[0].val).toBeUndefined()
    expect(result1Z.oblah[0].text).toEqual('123')
    expect(result1Z.nested.oblah.length).toEqual(1)
    expect(result1Z.nested.oblah[0].id).toEqual('b')
    expect(result1Z.nested.oblah[0].val).toEqual('BLAH')
    expect(result1Z.nested.oblah[0].message).toBeUndefined()
    expect(result1Z.nested.oblah[0].msg).toEqual('Replaced Again!')

    const result2A = await conn.db(db1).create(CONST.userCollection, {
      name: 'Cadel',
      surname: 'Evans',
      country: 'Australia',
      strength: 'GC',
      _secret: 'Smiling',
      year: {
        2010: ['1st, La Flèche Wallonne', "5th, Giro d'Italia", '6th, Tour Down Under'],
        2015: ['1st, Tour de France', '1st, Tirreno–Adriatico', '1st Tour de Romandie'],
        2012: ['7th, Tour de France'],
        2013: ["3rd, Giro d'Italia"]
      },
      rating: {
        sprint: 6,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7
      }
    }
      // { omit: { trimPrivateProps: true } }
    )

    expect(result2A).toBeDefined()
    expect(result2A[0]._key).toBeDefined()

    const result2B = await conn.db(db1).read(CONST.userCollection, { value: result2A[0]._key })

    expect(result2B.name).toEqual('Cadel')
    expect(result2B.surname).toEqual('Evans')
    // expect(result2B._secret).toBeUndefined()
    expect(result2B.year[2012].length).toEqual(1)
    expect(result2B.rating.sprint).toEqual(6)

    const result2C = await conn.db(db1).update(CONST.userCollection, {
      key: result2A[0]._key,
      data: {
        trademark: "G'day Mate",
        strength: 'All Rounder',
        year: { 2012: ['3rd, Critérium du Dauphiné'] },
        rating: { sprint: 7 }
      }
    })

    expect(result2C[0]._key).toBeDefined()

    const result2D = await conn.db(db1).read(CONST.userCollection, { value: result2A[0]._key })

    expect(result2D.name).toEqual('Cadel')
    expect(result2D.surname).toEqual('Evans')
    expect(result2D.trademark).toEqual("G'day Mate")
    expect(result2D.strength).toEqual('All Rounder')
    expect(result2D.year['2012']).toEqual(expect.arrayContaining(['3rd, Critérium du Dauphiné']))
    expect(result2D.year['2013']).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]))
    expect(result2D.rating).toEqual(
      expect.objectContaining({
        sprint: 7,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7
      })
    )

    const result2E = await conn.db(db1).update(CONST.userCollection, {
      key: {
        property: 'surname',
        value: 'Evans'
      },
      data: {
        trademark: 'Too Nice',
        strength: 'GC',
        year: { 2009: ['1st, UCI Road Race World Champs'] },
        rating: { solo: 8 }
      }
    })

    expect(result2E).toBeDefined()
    expect(Array.isArray(result2E)).toBeTruthy()
    expect(result2E.length).toEqual(1)
    expect(result2E[0]._key).toBeDefined()

    const result2F = await conn.db(db1).read(CONST.userCollection, { value: result2A[0]._key })

    expect(result2F.name).toEqual('Cadel')
    expect(result2F.surname).toEqual('Evans')
    expect(result2F.trademark).toEqual('Too Nice')
    expect(result2F.strength).toEqual('GC')
    expect(result2F.year['2012']).toEqual(expect.arrayContaining(['3rd, Critérium du Dauphiné']))
    expect(result2F.year['2013']).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]))
    expect(result2F.year['2009']).toEqual(expect.arrayContaining(['1st, UCI Road Race World Champs']))
    expect(result2F.rating).toEqual(
      expect.objectContaining({
        sprint: 7,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7,
        solo: 8
      })
    )

    const result2G = await conn.db(db1).read(CONST.userCollection, { value: 'Evans', property: 'surname' })

    expect(result2G.name).toEqual('Cadel')
    expect(result2G.surname).toEqual('Evans')

    const result2H = await conn.db(db1).delete(CONST.userCollection, { value: result2A[0]._key })

    expect(result2H[0]._key).toBeDefined()

    const result2I = await conn.db(db1).read(CONST.userCollection, { value: result2A[0]._key })

    expect(result2I).toBeNull()

    const result2J = await conn.db(db1).read(CONST.userCollection, { value: 'Evans', property: 'surname' })

    expect(result2J).toBeNull()

    const result3A = await conn.db(db1).create(CONST.userCollection, {
      name: 'Thomas',
      surname: 'Voeckler',
      country: 'France'
    })

    expect(result3A).toBeDefined()
    expect(result3A[0]._key).toBeDefined()

    const result3B = await conn.db(db1).read(CONST.userCollection, { value: result3A[0]._key })

    expect(result3B.name).toEqual('Thomas')
    expect(result3B.surname).toEqual('Voeckler')

    const result3C = await conn.db(db1).delete(CONST.userCollection, { value: 'Voeckler', property: 'surname' })

    expect(result3C).toBeDefined()
    expect(Array.isArray(result3C)).toBeTruthy()
    expect(result3C.length).toEqual(1)
    expect(result3C[0]._key).toBeDefined()

    const result3D = await conn.db(db1).read(CONST.userCollection, { value: result3A[0]._key })

    expect(result3D).toBeNull()

    const result4A = await conn.db(db1).update(CONST.userCollection, {
      key: {
        property: 'strength',
        value: 'Time Trial'
      },
      data: {
        rating: { timetrial: 9 }
      }
    })

    expect(result4A).toBeDefined()
    expect(Array.isArray(result4A)).toBeTruthy()
    expect(result4A.length).toEqual(3)
    expect(result4A[0]._key).toBeDefined()

    const result4B = (await db.fetchByProperties(CONST.userCollection, {
      properties: { property: 'strength', value: 'Time Trial' }
    })) as QueryResult

    expect(result4B.data.length).toEqual(3)

    const rohanDennisv1 = result4B.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv1.rating.timetrial).toEqual(9)

    const result4BWithLimit1 = (await db
      .fetchByProperties(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Time Trial' } },
        { limit: 2, sortBy: 'name', sortOrder: 'descending' }
      )) as QueryResult

    // FOR d IN @@value0 FILTER ( LOWER(d.@value1) == @value2 ) SORT d.@value3 DESC LIMIT 1, 2 RETURN d
    const result4BWithLimit2 = (await db
      .fetchByProperties(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Time Trial' } },
        { limit: 2, offset: 1, sortBy: 'name', sortOrder: 'descending' }
      )) as QueryResult

    expect(result4BWithLimit1.data.length).toEqual(2)
    expect(result4BWithLimit2.size).toEqual(2)
    expect(result4BWithLimit2.total).toEqual(3)

    expect(result4BWithLimit1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tony' }),
        expect.objectContaining({ name: 'Rohan' })
      ])
    )

    expect(result4BWithLimit2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Rohan' }),
        expect.objectContaining({ name: 'Fabian' })
      ])
    )

    const result4C = await conn.db(db1).update(CONST.userCollection, {
      key: {
        property: 'surname',
        value: 'Dennis'
      },
      data: {
        rating: { timetrial: 8 }
      }
    })

    expect(result4C).toBeDefined()
    expect(Array.isArray(result4C)).toBeTruthy()
    expect(result4C.length).toEqual(1)
    expect(result4C[0]._key).toBeDefined()

    const result4D = (await conn.db(db1)
      .fetchByPropertyValue(CONST.userCollection, {
        property: 'strength', value: 'Time Trial'
      })) as QueryResult

    expect(result4D.data.length).toEqual(3)

    const rohanDennisv2 = result4D.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv2.rating.timetrial).toEqual(8)

    const result4E = await conn.db(db1).updateProperty(CONST.userCollection, rohanDennisv2._key, 'rating.timetrial', 7)

    expect(result4E).toBeDefined()
    expect(Array.isArray(result4E)).toBeTruthy()
    expect(result4E.length).toEqual(1)
    expect(result4E[0]._key).toBeDefined()
    expect(result4E[0]['rating.timetrial']).toBeDefined()

    const result4F = (await conn.db(db1)
      .fetchByPropertyValue(CONST.userCollection, {
        property: 'strength', value: 'Time Trial'
      })) as QueryResult

    expect(result4F.data.length).toEqual(3)

    const rohanDennisv3 = result4F.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv3.rating.timetrial).toEqual(7)

    const result5A = await conn.db(db1).delete(CONST.userCollection, { property: 'strength', value: 'Break Aways' })

    expect(result5A).toBeDefined()
    expect(Array.isArray(result5A)).toBeTruthy()
    expect(result5A.length).toEqual(1)

    const result5B = (await db.fetchByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Break Aways' } }
    )) as QueryResult

    expect(result5B.data.length).toEqual(0)
  })

  test('returnAll, returnOne', async () => {
    const result1A = await conn
      .db(db1)
      .returnAll(aql`FOR d IN ${conn.collection(db1, CONST.userCollection)} FILTER d.strength LIKE "Time Trial" RETURN d`)

    expect(result1A.data.length).toEqual(3)
    expect(result1A.data[0].surname).toBeDefined()

    const result1ALiteral = await conn
      .db(db1)
      .returnAll(`FOR d IN ${CONST.userCollection} FILTER d.strength LIKE "Time Trial" RETURN d`)

    expect(result1ALiteral.data.length).toEqual(3)
    expect(result1ALiteral.data[0].surname).toBeDefined()

    const result1B = (await db.fetchByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Time Trial' } }
    )) as QueryResult

    expect(result1B.data.length).toEqual(3)
    expect(result1B.data[0].name).toBeDefined()
    expect(result1B.data[0].surname).toBeDefined()
    expect(result1B.data[0]._key).toBeDefined()

    const result1C = (await db.fetchByProperties(
      CONST.userCollection,
      { properties: { property: 'strength', value: 'Time Trial' } },
      {
        trim: { trimPrivateProps: true }
      }
    )) as QueryResult

    expect(result1C.data.length).toEqual(3)
    expect(result1C.data[0].name).toBeDefined()
    expect(result1C.data[0].surname).toBeDefined()
    expect(result1C.data[0]._key).toBeDefined()

    const result1D = (await db.fetchByProperties(
      CONST.userCollection,
      { properties: { property: 'strength', value: 'Time Trial' } },
      {
        trim: { trimPrivateProps: true }
      }
    )) as QueryResult

    expect(result1D.data.length).toEqual(3)
    expect(result1D.data[0].name).toBeDefined()
    expect(result1D.data[0].surname).toBeDefined()
    expect(result1D.data[0]._key).toBeDefined()

    const result1E = (await db.fetchByProperties(
      CONST.userCollection,
      { properties: { property: 'strength', value: 'Time Trial' } },
      { returnCursor: true }
    )) as ArrayCursor

    expect(result1E instanceof ArrayCursor).toBeTruthy()
    const allDocs = await result1E.all()
    expect(allDocs[0].surname).toBeDefined()

    const result2A = await conn.db(db1)
      .returnAll(aql`FOR d IN ${conn.collection(db1, CONST.userCollection)} FILTER d.strength LIKE "Trail Running" RETURN d`)

    expect(result2A.data).toBeDefined()
    expect(Array.isArray(result2A.data)).toBeTruthy()
    expect(result2A.data.length).toEqual(0)

    const result2B = (await db.fetchByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Trail Running' } }
    )) as QueryResult

    expect(result2B.data).toBeDefined()
    expect(Array.isArray(result2B.data)).toBeTruthy()
    expect(result2B.data.length).toEqual(0)

    const result3A = await conn.db(db1)
      .returnOne(aql`FOR d IN ${conn.collection(db1, CONST.userCollection)} FILTER d.strength LIKE "Trail Running" RETURN d`)

    expect(result3A).toBeNull()

    const result3B = await db.fetchOneByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Trail Running' } }
    )

    expect(result3B).toBeNull()

    const result4A = await conn.db(db1)
      .returnOne(aql`FOR d IN ${conn.collection(db1, CONST.userCollection)} FILTER d.strength LIKE "Time Trial" RETURN d`)

    expect(result4A).toBeDefined()
    expect(result4A.surname).toBeDefined()

    const result4B = await db.fetchOneByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Time Trial' } }
    )

    expect(result4B).toBeDefined()
    expect(result4B.surname).toBeDefined()

    const result5A = await conn.db(db1)
      .returnOne(aql`FOR d IN ${conn.collection(db1, CONST.userCollection)} FILTER d.surname LIKE "Impey" RETURN d`)

    expect(result5A).toBeDefined()
    expect(result5A.name).toEqual('Daryl')

    const result5B = await conn.db(db1)
      .fetchOneByPropertyValue(CONST.userCollection,
        { property: 'surname', value: 'Impey' }
      )

    expect(result5B).toBeDefined()
    expect(result5B.name).toEqual('Daryl')
    expect(result5B.surname).toEqual('Impey')
    expect(result5B._secret).toEqual('Rusks')
    expect(result5B._key).toBeDefined()

    const result5C = await conn.db(db1)
      .fetchOneByPropertyValue(
        CONST.userCollection,
        { property: 'surname', value: 'Impey' },
        { trim: { trimPrivateProps: true } }
      )

    expect(result5C).toBeDefined()
    expect(result5C.name).toEqual('Daryl')
    expect(result5C.surname).toEqual('Impey')
    expect(result5C._secret).toBeUndefined()
    expect(result5C._key).toBeDefined()

    const result5D = await db
      .fetchOneByProperties(
        CONST.userCollection,
        { properties: { property: 'surname', value: 'Impey' } },
        { trim: { trimPrivateProps: true } }
      )

    expect(result5D).toBeDefined()
    expect(result5D.name).toEqual('Daryl')
    expect(result5D.surname).toEqual('Impey')
    expect(result5B._secret).toEqual('Rusks')
    expect(result5D._key).toBeDefined()

    const result6A = (await db.fetchByProperties(CONST.userCollection, {
      properties: [
        { property: 'country', value: 'Belgium' },
        { property: 'strength', value: 'Classics' }
      ],
      match: MatchType.ALL
    })) as QueryResult

    expect(result6A.data.length).toEqual(3)
    expect(result6A.data[0].name === 'Wout' || result6A.data[0].name === 'Tim' || result6A.data[0].name === 'Greg').toBeTruthy()
    expect(result6A.data[1].surname === 'van Aert' || result6A.data[1].surname === 'Wellens' || result6A.data[1].surname === 'van Avermaet').toBeTruthy()

    const result6B = (await db.fetchByProperties(CONST.userCollection, {
      properties: [
        { property: 'country', value: 'UK' },
        { property: 'strength', value: 'Classics' }
      ],
      match: MatchType.ALL
    })) as QueryResult

    expect(result6B.data.length).toEqual(0)

    const result7A = await conn.db(db1).fetchOneByAllPropertyValues(CONST.userCollection,
      [
        { property: 'country', value: 'Belgium' },
        { property: 'strength', value: 'Classics' }
      ]
    )

    expect(result7A.surname === 'van Aert' || result7A.surname === 'Wellens').toBeTruthy()

    const result7B = await db.fetchOneByProperties(CONST.userCollection, {
      properties: [
        { property: 'name', value: 'Jan' },
        { property: 'surname', value: 'Ullrich' }
      ],
      match: MatchType.ALL
    })

    expect(result7B.surname).toEqual('Ullrich')

    const result7C = await db.fetchOneByProperties(CONST.userCollection, {
      properties: [
        { property: 'name', value: 'Jan' },
        { property: 'surname', value: 'Armstrong' }
      ],
      match: MatchType.ALL
    })

    expect(result7C).toBeNull()
  })

  test('fetchByPropertyValue', async () => {
    const result1A = (await db.fetchByProperties(CONST.userCollection, {
      properties: { property: 'name', value: 'Daryl' }
    })) as QueryResult

    expect(result1A.data.length).toEqual(1)

    const result1B = (await db.fetchByProperties(CONST.userCollection, {
      properties: { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
    })) as QueryResult

    expect(result1B.data.length).toEqual(1)

    const result1C = (await conn.db(db1)
      .fetchByAllPropertyValues(CONST.userCollection, [
        { property: 'favoriteRoads.SouthAfrica.CapeTown', value: 'Chapmans Peak' },
        { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
      ])) as QueryResult

    expect(result1C.data.length).toEqual(1)

    const result1D = (await conn.db(db1)
      .fetchByAllPropertyValues(CONST.userCollection, [
        { property: 'favoriteRoads.SouthAfrica.CapeTown', value: 'Chappies' },
        { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
      ])) as QueryResult

    expect(result1D.data.length).toEqual(0)

    const result1E = (await conn.db(db1)
      .fetchByAnyPropertyValue(CONST.userCollection, [
        { property: 'favoriteRoads.SouthAfrica.CapeTown', value: 'Chappies' },
        { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
      ])) as QueryResult

    expect(result1E.data.length).toEqual(1)

    const result1F = (await conn.db(db1)
      .fetchByAnyPropertyValue(CONST.userCollection, [
        { property: 'country', value: 'UK' },
        { property: 'country', value: 'Spain' }
      ])) as QueryResult

    expect(result1F.data.length).toEqual(6)

    const result1G = (await conn.db(db1)
      .fetchByAllPropertyValues(CONST.userCollection, [
        { property: 'country', value: 'UK' },
        { property: 'country', value: 'Spain' }
      ])) as QueryResult

    expect(result1G.data.length).toEqual(0)

    const result1H = (await conn.db(db1)
      .fetchByAllPropertyValues(CONST.userCollection, [
        { property: 'country', value: 'UK' },
        { property: 'strength', value: 'General Classification' }
      ])) as QueryResult

    expect(result1H.data.length).toEqual(2)

    const result1J = (await conn.db(db1).fetchByPropertyValue(CONST.userCollection, {
      property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra'
    })) as QueryResult

    expect(result1J.data.length).toEqual(1)

    const result1K = (await conn.db(db1).fetchByPropertyValue(CONST.userCollection, {
      property: 'favoriteRoads.Portugal.Lisbon', value: 'sintra'
    })) as QueryResult

    expect(result1K.data.length).toEqual(1)

    const result1L = (await conn.db(db1).fetchByPropertyValue(CONST.userCollection, {
      property: 'favoriteRoads.Portugal.Lisbon', value: 'sintra', caseSensitive: true
    })) as QueryResult

    expect(result1L.data.length).toEqual(0)

    const result1M = (await conn.db(db1)
      .fetchByPropertyValue(CONST.userCollection, { property: 'stats.grandTours', value: 21 }
      )) as QueryResult

    expect(result1M.data.length).toEqual(4)

    const result1N = (await conn.db(db1)
      .fetchByPropertyValue(CONST.userCollection, { property: 'stats.grandTours', value: 21, caseSensitive: true }
      )) as QueryResult

    expect(result1N.data.length).toEqual(4)
  })

  test('fetchByPropertySearch', async () => {
    // FOR d IN @@value0 FILTER ( LIKE(d.@value1, @value2, true) || LIKE(d.@value1, @value3, true) ) RETURN d
    // bindVars: {
    //   '@value0': 'cyclists',
    //   value1: 'name',
    //   value2: '%lance%',
    //   value3: '%chris%'
    // }
    const result1A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        search: {
          properties: 'name', terms: ['lance', 'chris']
        }
      }) as QueryResult

    expect(result1A.data.length).toEqual(2)
    expect(result1A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Chris', surname: 'Froome' })
      ])
    )

    const result2A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        search: {
          properties: 'name', terms: ['mar']
        }
      }) as QueryResult

    expect(result2A.data.length).toEqual(3)
    expect(result2A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    // FOR d IN @@value0 FILTER (LIKE(d.@value1, @value2, true) ) RETURN d
    // bindVars: { '@value0': 'cyclists', value1: 'name', value2: '%%' }
    const result3A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        search: {
          properties: 'name', terms: ''
        }
      }) as QueryResult

    expect(result3A.data.length).toEqual(31)
  })

  test('fetchByFilters', async () => {
    const result1A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, 'd.name == "Lance" || d.name == "Chris"') as QueryResult

    expect(result1A.data.length).toEqual(2)
    expect(result1A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Chris', surname: 'Froome' })
      ])
    )

    const result1B = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        filter: {
          filters: ['d.name == "Lance"', 'd.name == "Chris"'],
          match: MatchType.ANY
        }
      }) as QueryResult

    expect(result1B.data.length).toEqual(2)
    expect(result1B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Chris', surname: 'Froome' })
      ])
    )

    const lance = 'Lance'
    const chris = 'Chris'

    const result1C = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, aql`d.name == ${lance} || d.name == ${chris}`, {
        returnCursor: true
      }) as ArrayCursor

    expect(result1C instanceof ArrayCursor).toBeTruthy()

    const result2A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, 'LIKE(d.name, "%mar%", true)') as QueryResult

    expect(result2A.data.length).toEqual(3)
    expect(result2A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const likeMar = '%mar%'
    const climbing = 'Climbing'

    const result2B = await conn.db(db1).fetchByCriteria(CONST.userCollection,
      aql`LIKE(d.name, ${likeMar}, true) && d.strength == ${climbing}`
    ) as QueryResult

    expect(result2B.data.length).toEqual(2)
    expect(result2B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const result2C = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        filter: {
          filters: ['LIKE(d.name, "%mar%", true)', 'd.strength == "Climbing"'],
          match: MatchType.ALL
        }
      }) as QueryResult

    expect(result2C.data.length).toEqual(2)
    expect(result2C.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const result2D = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        filter: {
          filters: ['LIKE(d.name, "%mar%", true)', 'd.strength == "Climbing"'],
          match: MatchType.ANY
        }
      }) as QueryResult

    expect(result2D.data.length).toEqual(3)
    expect(result2D.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    // const result2B = await conn.db(db1)
    //   .fetchByFilterCriteria(CONST.userCollection, 'name LIKE "%mar%"') as QueryResult // does not return a result
    // // .fetchByFilterCriteria(CONST.userCollection, 'name LIKE "lance"') as QueryResult // does return a result

    const result3A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, 'd.country == "Italy" && d.strength == "General Classification"') as QueryResult

    expect(result3A.data.length).toEqual(2)
    expect(result3A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )
  })

  test('fetchByCriteria', async () => {
    const result1A = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength == "Climbing"',
          search: { properties: 'name', terms: 'mar' }
        }
      ) as QueryResult

    expect(result1A.data.length).toEqual(3)
    expect(result1A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const result1AB = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength == "Climbing"',
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1AB.data.length).toEqual(2)
    expect(result1AB.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const result1B = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength != NULL',
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ANY
        }
      ) as QueryResult

    expect(result1B.data.length).toEqual(30)

    const none = 'NULL'

    const result1BB = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: aql`d.strength != ${none}`,
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1BB.data.length).toEqual(3)

    const result2A = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength == "Zooming"',
          search: { properties: 'name', terms: 'mar' }
        }
      ) as QueryResult

    expect(result2A.data.length).toEqual(3)

    const zoom = 'Zooming'

    // FOR d IN @@value0 FILTER ( ( d.strength == @value1 ) && ( LIKE(d.@value2, @value3, true) ) ) RETURN d
    // bindVars: {
    //   value1: 'Zooming',
    //   value2: 'name',
    //   value3: '%mar%'
    // }
    const result2AB = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: aql`d.strength == ${zoom}`,
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result2AB.data.length).toEqual(0)

    const result2B = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength != "Zooming"',
          search: { properties: 'name', terms: 'mar' }
        }
      ) as QueryResult

    expect(result2B.data.length).toEqual(31)

    // FOR d IN cyclists FILTER ( ( d.strength != "Zooming" ) && ( LIKE(d.name, "%mar%", true) ) ) RETURN d
    const result2BB = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength != "Zooming"',
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result2BB.data.length).toEqual(3)

    // FOR d IN @@value0 FILTER ( d.strength == "Climbing" ) RETURN d
    const result3A = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength == "Climbing"'
        }
      ) as QueryResult

    expect(result3A.data.length).toEqual(2)

    // FOR d IN cyclists FILTER ( LIKE(d.name, "%mar%", true) ) RETURN d
    const result4A = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          search: { properties: 'name', terms: 'mar' }
        }
      ) as QueryResult

    expect(result4A.data.length).toEqual(3)
  })

  test('fetchByPropertyValueAndCriteria', async () => {
    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( LIKE(d.@value3, @value4, true) )) RETURN d
    // bindVars: {
    //   value1: 'strength',
    //   value2: 'climbing',
    //   value3: 'name',
    //   value4: '%mar%'
    // }
    const result1A = await db
      .fetchByPropertiesAndCriteria(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Climbing' } },
        { search: { properties: 'name', terms: 'mar' } }
      ) as QueryResult

    expect(result1A.data.length).toEqual(2)
    expect(result1A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const name = 'name'
    const likeMar = '%mar%'

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( LIKE(d.@value3, @value4, true) )) RETURN d
    // bindVars: {
    //   value1: 'strength',
    //   value2: 'climbing',
    //   value3: 'name',
    //   value4: '%mar%'
    // }
    const result1B = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Climbing' },
        { filter: aql`LIKE(d.${name}, ${likeMar}, true)` }
      ) as QueryResult

    expect(result1B.data.length).toEqual(2)
    expect(result1B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( LIKE(d.name, "%mar%", true) )) RETURN d
    // bindVars: { '@value0': 'cyclists', value1: 'strength', value2: 'climbing' }
    const result1C = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Climbing' },
        { filter: { filters: ['LIKE(d.name, "%mar%", true)'] } }
      ) as QueryResult

    expect(result1C.data.length).toEqual(2)
    expect(result1C.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    // Criteria is missing, should throw an error
    // const result1D = await conn.db(db1)
    //   .fetchByPropertyValueAndCriteria(
    //     CONST.userCollection,
    //     { name: 'strength', value: 'Sprinter' }
    //   ) as QueryResult

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( ( d.surname == "Pantani" ) || ( LIKE(d.@value3, @value4, true) ) )) RETURN d
    // bindVars: {
    //   value1: 'strength',
    //   value2: 'climbing',
    //   value3: 'name',
    //   value4: '%mar%'
    // }
    const result1E = await db
      .fetchByPropertiesAndCriteria(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Climbing' } },
        {
          search: { properties: 'name', terms: 'mar' },
          filter: 'd.surname == "Pantani"'
        }
      ) as QueryResult

    expect(result1E.data.length).toEqual(2)
    expect(result1E.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marc', surname: 'Soler' }),
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' })
      ])
    )

    const result1F = await db
      .fetchByPropertiesAndCriteria(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Climbing' } },
        {
          search: { properties: 'name', terms: 'mar' },
          filter: 'd.surname == "Pantani"',
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1F.data.length).toEqual(1)
    expect(result1F.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' })
      ])
    )

    // const result1K = await db
    //   .fetchByPropertyValueAndCriteria(
    //     CONST.userCollection,
    //     { property: 'strength', value: 'Sprinter' },
    //     { search: { properties: 'country', terms: 'ia' } }
    //   ) as QueryResult

    const result1K = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Sprinter' },
        { search: { properties: 'country', terms: 'ia' } }
      ) as QueryResult

    expect(result1K.data.length).toEqual(2)
    expect(result1K.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia' })
      ])
    )

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( LIKE(d.surname, "%cav%", true) )) RETURN d
    // bindVars: { '@value0': 'cyclists', value1: 'strength', value2: 'sprinter' }
    const result1L = await db
      .fetchByPropertiesAndCriteria(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Sprinter' } },
        { filter: 'LIKE(d.surname, "%cav%", true)' }
      ) as QueryResult

    expect(result1L.data.length).toEqual(1)
    expect(result1L.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish', country: 'UK' })
      ])
    )

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( ( LIKE(d.surname, "%cav%", true) ) || ( LIKE(d.@value3, @value4, true) ) )) RETURN d
    // bindVars: {
    //   value1: 'strength',
    //   value2: 'sprinter',
    //   value3: 'country',
    //   value4: '%ia%'
    // }
    const result1M = await db
      .fetchByPropertiesAndCriteria(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Sprinter' } },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%cav%", true)',
          match: MatchType.ANY
        }
      ) as QueryResult

    expect(result1M.data.length).toEqual(3)
    expect(result1M.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish', country: 'UK' })
      ])
    )

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( ( LIKE(d.surname, "%cav%", true) ) && ( LIKE(d.@value3, @value4, true) ) )) RETURN d
    // bindVars: {
    //   '@value0': 'cyclists',
    //   value1: 'strength',
    //   value2: 'sprinter',
    //   value3: 'country',
    //   value4: '%ia%'
    // }
    const result1N = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Sprinter' },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%cav%", true)',
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1N.data.length).toEqual(0)

    const result1P = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Sprinter' },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%an%", true)',
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1P.data.length).toEqual(2)

    expect(result1P.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia' })
      ])
    )

    const result200A = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Zooming' },
        { search: { properties: 'name', terms: 'mar' } }
      ) as QueryResult

    expect(result200A.data.length).toEqual(0)

    const result3A = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Climbing' },
        { search: { properties: 'name', terms: 'wil' } }
      ) as QueryResult

    expect(result3A.data.length).toEqual(0)

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value3) == @value4 ) AND ( LIKE(d.@value5, @value6, true) )) RETURN d
    // bindVars: {
    //   value1: 'country',
    //   value2: 'uk',
    //   value3: 'strength',
    //   value4: 'general classification',
    //   value5: 'name',
    //   value6: '%aint%'
    // }
    const result2A = await conn.db(db1).fetchByAnyPropertyValueAndCriteria(
      CONST.userCollection,
      [
        { property: 'country', value: 'UK' },
        { property: 'strength', value: 'General Classification' }
      ],
      { search: { properties: 'name', terms: 'aint' } }
    ) as QueryResult

    // const Z = await conn.db(db1)
    //   .fetchByAllPropertyValuesAndCriteria(
    //     CONST.userCollection,
    //     {
    //       properties: [
    //         { name: 'country', value: 'UK' },
    //         { name: 'strength', value: 'General Classification' }
    //       ],
    //       match: MatchType.ALL
    //     },
    //     { search: { properties: 'name', terms: 'aint' } }
    //   ) as QueryResult

    expect(result2A.data.length).toEqual(1)
    expect(result2A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Geraint', surname: 'Thomas' })
      ])
    )

    const result2B = await db.fetchByPropertiesAndCriteria(
      CONST.userCollection, {
        properties: [
          { property: 'country', value: 'UK' },
          { property: 'strength', value: 'Sprinter' }
        ],
        match: MatchType.ALL
      },
      { search: { properties: 'name', terms: 'aint' } }
    ) as QueryResult

    expect(result2B.data.length).toEqual(0)

    const result2C = await db.fetchByPropertiesAndCriteria(
      CONST.userCollection, {
        properties: [
          { property: 'country', value: 'UK' },
          { property: 'strength', value: 'General Classification' }
        ],
        match: MatchType.ALL
      },
      { search: { properties: 'name', terms: 'wil' } }
    ) as QueryResult

    expect(result2C.data.length).toEqual(0)

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value1) == @value3 ) AND ( LIKE(d.@value4, @value5, true) )) RETURN d
    // bindVars: {
    //   value1: 'country',
    //   value2: 'germany',
    //   value3: 'switzerland',
    //   value4: 'strength',
    //   value5: '%time%'
    // }
    const result2D = await db.fetchByPropertiesAndCriteria(
      CONST.userCollection, {
        properties: [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        match: MatchType.ANY
      },
      { search: { properties: 'strength', terms: 'time' } }
    ) as QueryResult

    expect(result2D.data.length).toEqual(2)

    // const result3D = await conn.db(db1)
    //   .fetchByPropertyValuesAndCriteria(
    //     CONST.userCollection,
    //     {
    //       properties: [
    //         { name: 'country', value: 'Germany' },
    //         { name: 'country', value: 'Switzerland' }
    //       ],
    //       match: MatchType.ANY
    //     },
    //     { search: { properties: 'strength', terms: 'time' } }
    //   ) as QueryResult

    // expect(result3D.data.length).toEqual(2)

    const result2E = await conn.db(db1)
      .fetchByAllPropertyValuesAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        { search: { properties: 'strength', terms: 'time' } }
      ) as QueryResult

    expect(result2E.data.length).toEqual(0)

    const likeTime = '%time%'

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value1) == @value3 ) AND ( LIKE(d.strength, @value4, true) )) RETURN d
    // bindVars: {
    //   value1: 'country',
    //   value2: 'germany',
    //   value3: 'switzerland',
    //   value4: '%time%'
    // }
    const result2F = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        { filter: aql`LIKE(d.strength, ${likeTime}, true)` }
      ) as QueryResult

    expect(result2F.data.length).toEqual(2)

    const result2G = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        { filter: { filters: ['LIKE(d.strength, "%time%", true)'] } }
      ) as QueryResult

    expect(result2G.data.length).toEqual(2)

    // Should throw an error, criteria is missing
    // const result2H = await conn.db(db1)
    //   .fetchByAllPropertyValuesAndCriteria(
    //     CONST.userCollection,
    //     [
    //       { name: 'country', value: 'UK' },
    //       { name: 'strength', value: 'General Classification' }
    //     ]
    //   ) as QueryResult

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value1) == @value3 || LOWER(d.@value1) == @value4 ) AND ( LIKE(d.@value5, @value6, true) )) RETURN d
    // bindVars: {
    //   value1: 'strength',
    //   value2: 'general classification',
    //   value3: 'time trial',
    //   value4: 'sprinter',
    //   value5: 'country',
    //   value6: '%ia%'
    // }
    const result2J = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'strength', value: 'General Classification' },
          { property: 'strength', value: 'Time Trial' },
          { property: 'strength', value: 'Sprinter' }
        ],
        {
          search: { properties: 'country', terms: 'ia' }
        }
      ) as QueryResult

    expect(result2J.data.length).toEqual(4)
    expect(result2J.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tadej', surname: 'Pogačar', country: 'Slovenia', strength: 'General Classification' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia', strength: 'Sprinter' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia', strength: 'Sprinter' }),
        expect.objectContaining({ name: 'Rohan', surname: 'Dennis', country: 'Australia', strength: 'Time Trial' })
      ])
    )

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value1) == @value3 || LOWER(d.@value1) == @value4 ) AND ( ( LIKE(d.surname, "%cav%", true) ) || ( LIKE(d.@value5, @value6, true) ) )) RETURN d
    //  bindVars: {
    //   value1: 'strength',
    //   value2: 'general classification',
    //   value3: 'time trial',
    //   value4: 'sprinter',
    //   value5: 'country',
    //   value6: '%ia%'
    // }
    const result2K = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'strength', value: 'General Classification' },
          { property: 'strength', value: 'Time Trial' },
          { property: 'strength', value: 'Sprinter' }
        ],
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%cav%", true)',
          match: MatchType.ANY
        }
      ) as QueryResult

    expect(result2K.data.length).toEqual(5)
    expect(result2K.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tadej', surname: 'Pogačar', country: 'Slovenia', strength: 'General Classification' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia', strength: 'Sprinter' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia', strength: 'Sprinter' }),
        expect.objectContaining({ name: 'Rohan', surname: 'Dennis', country: 'Australia', strength: 'Time Trial' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish', country: 'UK', strength: 'Sprinter' })
      ])
    )

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value1) == @value3 || LOWER(d.@value1) == @value4 ) AND ( ( LIKE(d.surname, "%an%", true) ) && (  LIKE(d.@value5, @value6, true) ) ) ) RETURN d
    // bindVars: {
    //   value1: 'strength',
    //   value2: 'general classification',
    //   value3: 'time trial',
    //   value4: 'sprinter',
    //   value5: 'country',
    //   value6: '%ia%'
    // }
    const result2L = await db
      .fetchByPropertiesAndCriteria(
        CONST.userCollection, {
          properties: [
            { property: 'strength', value: 'General Classification' },
            { property: 'strength', value: 'Time Trial' },
            { property: 'strength', value: 'Sprinter' }
          ]
        },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%an%", true)',
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result2L.data.length).toEqual(2)
    expect(result2L.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia', strength: 'Sprinter' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia', strength: 'Sprinter' })
      ])
    )

    const result2M = await conn.db(db1)
      .fetchByAllPropertyValuesAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Belgium' },
          { property: 'strength', value: 'Classics' }
        ],
        {
          search: { properties: 'trademark', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2M.data.length).toEqual(1)

    const result2N = await conn.db(db1)
      .fetchByAllPropertyValuesAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Slovenia' },
          { property: 'strength', value: 'Classics' }
        ],
        {
          search: { properties: 'trademark', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2N.data.length).toEqual(0)

    // FOR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 || LOWER(d.@value3) == @value4 ) AND ( LIKE(d.@value5, @value6, true) ) ) RETURN d
    // bindVars: {
    //   value1: 'country',
    //   value2: 'slovenia',
    //   value3: 'strength',
    //   value4: 'classics',
    //   value5: 'trademark',
    //   value6: '%do it all%'
    // }
    const result2P = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Slovenia' },
          { property: 'strength', value: 'Classics' }
        ],
        {
          search: { properties: 'trademark', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2P.data.length).toEqual(1)

    const result2Q = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Slovenia' },
          { property: 'strength', value: 'Sprinter' }
        ],
        {
          search: { properties: 'trademark', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2Q.data.length).toEqual(0)
  })

  test('Array Search', async () => {
    const result1B = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        '"2024, Castellon Gravel Race, 1st" IN d.results.list'
      ) as QueryResult

    expect(result1B.data.length).toEqual(1)
    expect(result1B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    // FOR d IN @@value0 FILTER ( LIKE(TO_STRING(d.results.list), "%Gravel%", true) ) RETURN d
    const result2A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        'LIKE(TO_STRING(d.results.list), "%Gravel%", true)'
      ) as QueryResult

    expect(result2A.data.length).toEqual(5)
    expect(result2A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' }),
        expect.objectContaining({ name: 'Mathieu', surname: 'van der Poel' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Matt', surname: 'Beers' })
      ])
    )

    const resultsProp = 'results' // results.list doesnt work
    const summaryProp = 'list'
    const containsGravel = '%Gravel%'

    // FOR d IN @@value0 FILTER ( LIKE(d.@value1.@value2, @value3, true) ) RETURN d
    // bindVars: {
    //     value1: 'results',
    //     value2: 'list',
    //     value3: '%Gravel%'
    // }
    // The test above this one uses a TOSTRING to turn the results array into a string
    // on which it then performs a LIKE - however, it seems that leaving out the
    // TOSTRING still works as expected - the filter only returns matching entries
    const result2B = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        aql`LIKE(d.${resultsProp}.${summaryProp}, ${containsGravel}, true)`
      ) as QueryResult

    expect(result2B.data.length).toEqual(5)
    expect(result2B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' }),
        expect.objectContaining({ name: 'Mathieu', surname: 'van der Poel' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Matt', surname: 'Beers' })
      ])
    )

    const yearProp = 'year'
    const year2015 = '2015'
    const results2015 = 'results.year.2015'
    const containsTirreno = '%Tirreno%'
    const containsFrance = '%france%'

    // returns correct results and the bind operation results in correct AQL
    // FOR d IN @@value0 FILTER ( LIKE(d.@value1.@value2.@value3, @value4, true) ) RETURN d
    // bindVars: {
    //     value1: 'results',
    //     value2: 'year',
    //     value3: '2015',
    //     value4: '%Tirreno%'
    // }
    const result2C = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        aql`LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsTirreno}, true)`
      ) as QueryResult

    expect(result2C.data.length).toEqual(2)
    expect(result2C.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' })
      ])
    )

    const result2D = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        aql`LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsFrance}, true)`
      ) as QueryResult

    expect(result2D.data.length).toEqual(7)
    expect(result2D.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Thibaut', surname: 'Pinot' }),
        expect.objectContaining({ name: 'Chris', surname: 'Froome' })
      ])
    )

    // returns no results because of the way results2015 is bound, eg
    // FOR d IN @@value0 FILTER ( LIKE(d.@value1, @value2, true) ) RETURN d
    // bindVars: {
    //   value1: 'results.year.2015',
    //   value2: '%Tirreno%'
    // }
    const result2E = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        aql`LIKE(d.${results2015}, ${containsTirreno}, true)`
      ) as QueryResult

    expect(result2E.data.length).toEqual(0)

    // FOR d IN @@value0 FILTER ( LIKE(d.@value1.@value2.@value3, @value4, true) ) RETURN d
    // bindVars: {
    //     value1: 'results',
    //     value2: 'year',
    //     value3: '2015',
    //     value4: '%Tirreno%'
    // }
    const result2F = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        { search: { properties: results2015, terms: 'Tirreno' } }
      ) as QueryResult

    // console.log(result2F)
    expect(result2F.data.length).toEqual(2)
    expect(result2F.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' })
      ])
    )

    // Liège UCI Roubaix Sanremo
    const containsSanremo = '%Sanremo%'

    const result2G = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        aql`LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsTirreno}, true) || LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsSanremo}, true)`
      ) as QueryResult

    expect(result2G.data.length).toEqual(4)
    expect(result2G.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
      ])
    )

    // FOR d IN @@value0 FILTER ( LIKE(d.@value1.@value2.@value3, @value4, true) || LIKE(d.@value1.@value2.@value3, @value5, true) ) RETURN d
    // bindVars: {
    //     value1: 'results',
    //     value2: 'year',
    //     value3: '2015',
    //     value4: '%Tirreno%',
    //     value5: '%Sanremo%'
    // }
    const result2H = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        { search: { properties: results2015, terms: ['Tirreno', 'Sanremo'] } }
      ) as QueryResult

    expect(result2H.data.length).toEqual(4)
    expect(result2H.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
      ])
    )

    const palmares = 'palmares'

    // FOR d IN @@value0 FILTER ( LIKE(d.@value1, @value2, true) || LIKE(d.@value1, @value3, true) ) RETURN d
    // bindVars: {
    //   value1: 'palmares',
    //   value2: '%Waffle%',
    //   value3: '%12th%'
    // }
    const result2J = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        { search: { properties: palmares, terms: ['Waffle', '12th'] } }
      ) as QueryResult

    expect(result2J.data.length).toEqual(3)
    expect(result2J.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Matt', surname: 'Beers' })
      ])
    )

    const sprinter = 'Sprinter'
    const containsRoubaix = '%Roubaix%'

    const result2K = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        aql`d.strength == ${sprinter} && (LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsRoubaix}, true) || LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsSanremo}, true))`
      ) as QueryResult

    expect(result2K.data.length).toEqual(2)
    expect(result2K.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' })
      ])
    )

    // OR d IN @@value0 FILTER ( ( LOWER(d.@value1) == @value2 ) AND ( LIKE(d.@value3.@value4.@value5, @value6, true) || LIKE(d.@value3.@value4.@value5, @value7, true) ) ) RETURN d
    // bindVars: {
    //     value1: 'strength',
    //     value2: 'sprinter',
    //     value3: 'results',
    //     value4: 'year',
    //     value5: '2015',
    //     value6: '%Roubaix%',
    //     value7: '%Sanremo%'
    // }
    const result2L = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(CONST.userCollection,
        { property: 'strength', value: sprinter },
        { search: { properties: results2015, terms: ['Roubaix', 'Sanremo'] } },
        { debugFilters: false }
      ) as QueryResult

    expect(result2L.data.length).toEqual(2)
    expect(result2L.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' })
      ])
    )
  })

  test('Delete database', async () => {
    expect.assertions(4)

    // await conn.system.dropDatabase(db1)
    // const testDB1Exists = await conn.db(db1).dbExists()
    // expect(testDB1Exists).toBeFalsy()

    await conn.system.dropDatabase(db2)
    const db2Exists = await conn.db(db2).dbExists()
    expect(db2Exists).toBeFalsy()

    try {
      await conn.system.dropDatabase(db2)
    } catch (e) {
      expect(e.response.body.code).toEqual(404)
      expect(e.response.body.errorNum).toEqual(1228)
      expect(e.response.body.errorMessage).toEqual('database not found')
    }
  })
})

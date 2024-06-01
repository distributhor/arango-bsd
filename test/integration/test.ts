/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable jest/no-conditional-expect */
import * as path from 'path'
import * as dotenv from 'dotenv'
import { aql } from 'arangojs/aql'
import { ArrayCursor } from 'arangojs/cursor'
import { ArangoConnection, ArangoDBWithoutSauce } from '../../src/index'
import { DBStructure, MatchType, QueryResult } from '../../src/types'

import cyclists from './cyclists.json'
import teams from './teams.json'

for (const c of cyclists) {
  if (c.results) {
    c['resultsV2'] = c.results.map(r => `${r.year}, ${r.race}, ${r.position}`)
    if (c['resultsV2']) {
      c['palmares'] = c['resultsV2'].join('; ')
    }
  }
}

dotenv.config({ path: path.join(__dirname, '.env') })

const db1 = 'guacamole-test1'
const db2 = 'guacamole-test2'

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

const dbStructure: DBStructure = {
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

const conn = new ArangoConnection({
  databaseName: db1,
  url: process.env.GUACAMOLE_TEST_DB_URI,
  auth: { username: dbAdminUser, password: dbAdminPassword }
}, { printQueries: false })

const db = new ArangoDBWithoutSauce({
  databaseName: db1,
  url: process.env.GUACAMOLE_TEST_DB_URI,
  auth: { username: dbAdminUser, password: dbAdminPassword }
}, { printQueries: false })

describe('Guacamole Integration Tests', () => {
  test('Connection and instance management', async () => {
    expect(conn.db(db1).name).toEqual(db1)
    expect(conn.system.name).toEqual('_system')
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
    const result1 = await conn.db(db1).createDBStructure(dbStructure)

    // create structure for non-existing DB
    const result2 = await conn.db(db2).createDBStructure(dbStructure)

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

    const usersCollectionExist = await conn.db(db1).col(CONST.userCollection).exists()
    const groupsCollectionExist = await conn.db(db1).col(CONST.groupCollection).exists()
    const userGroupsCollectionExist = await conn.db(db1).col(CONST.userToGroupEdge).exists()

    expect(usersCollectionOnSystemDB1).toBeFalsy()
    expect(usersCollectionExist).toBeTruthy()
    expect(groupsCollectionExist).toBeTruthy()
    expect(userGroupsCollectionExist).toBeTruthy()

    // remove a collection and recreate the structure
    // await conn.driver(db2).graph(CONST.groupMembershipGraph).drop()
    await conn.driver(db2).graph(CONST.groupMembershipGraph).removeEdgeDefinition(CONST.userToGroupEdge)
    await conn.driver(db2).graph(CONST.groupMembershipGraph).removeVertexCollection(CONST.userCollection)
    await conn.driver(db2).collection(CONST.userCollection).drop()
    const usersCollectionExist2 = await conn.db(db2).col(CONST.userCollection).exists()
    expect(usersCollectionExist2).toBeFalsy()

    const result3 = await conn.db(db2).createDBStructure(dbStructure)

    expect(result3.database).toEqual('Database found')
    expect(result3.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' found`]))
    expect(result3.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' found`
      ])
    )

    const usersCollectionExist3 = await conn.db(db2).col(CONST.userCollection).exists()
    expect(usersCollectionExist3).toBeTruthy()

    // confirm that empty array values do not break anything, ie, that they
    // are essentially unhandled and nothing happens, so it's a safe operation
    const dbStructureWithEmptyArrays: DBStructure = {
      collections: [],
      graphs: [
        {
          graph: 'xyz',
          edges: []
        }
      ]
    }

    const result4 = await conn.db(db2).createDBStructure(dbStructureWithEmptyArrays)

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

    const result = await conn.db(db1).validateDBStructure(dbStructure)

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

    expect(result1.length).toEqual(30)
    expect(result2.length).toEqual(16)
  })

  test('Unique constraint validation', async () => {
    // should be case insensitive PT1
    const result1 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [{ unique: { property: 'fame', value: 'Chief Doper' } }]
    })

    expect(result1.violatesUniqueConstraint).toBeTruthy()

    // should be case insensitive PT2
    const result1DifferentCase1 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [{ unique: { property: 'fame', value: 'Chief DOPER' } }]
    })

    expect(result1DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    // should be case sensitive
    const result1DifferentCase2 = await conn.db(db1).validateUniqueConstraint({
      caseInsensitive: true,
      collection: CONST.userCollection,
      constraints: [{ unique: { property: 'fame', value: 'Chief DOPER' } }]
    })

    expect(result1DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result2 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [{ unique: { property: 'fame', value: 'Tornado' } }]
    })

    expect(result2.violatesUniqueConstraint).toBeFalsy()

    const result3 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [
        { unique: { property: 'fame', value: 'Tornado' } },
        { unique: { property: 'surname', value: 'Armstrong' } }
      ]
    })

    expect(result3.violatesUniqueConstraint).toBeTruthy()

    const result3DifferentCase1 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [
        { unique: { property: 'fame', value: 'TORNADO' } },
        { unique: { property: 'surname', value: 'ArmSTRONG' } }
      ]
    })

    expect(result3DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    const result3DifferentCase2 = await conn.db(db1).validateUniqueConstraint({
      caseInsensitive: true,
      collection: CONST.userCollection,
      constraints: [
        { unique: { property: 'fame', value: 'TORNADO' } },
        { unique: { property: 'surname', value: 'ArmSTRONG' } }
      ]
    })

    expect(result3DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result4 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [
        { unique: { property: 'fame', value: 'Tornado' } },
        { unique: { property: 'surname', value: 'Voeckler' } }
      ]
    })

    expect(result4.violatesUniqueConstraint).toBeFalsy()

    const result5 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [
        {
          composite: [
            { property: 'name', value: 'Thomas' },
            { property: 'surname', value: 'de Ghent' }
          ]
        }
      ]
    })

    expect(result5.violatesUniqueConstraint).toBeTruthy()

    const result5DifferentCase1 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [
        {
          composite: [
            { property: 'name', value: 'THOMAS' },
            { property: 'surname', value: 'DE Ghent' }
          ]
        }
      ]
    })

    expect(result5DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    const result5DifferentCase2 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      caseInsensitive: true,
      constraints: [
        {
          composite: [
            { property: 'name', value: 'THOMAS' },
            { property: 'surname', value: 'DE Ghent' }
          ]
        }
      ]
    })

    expect(result5DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result6 = await conn.db(db1).validateUniqueConstraint({
      collection: CONST.userCollection,
      constraints: [
        {
          composite: [
            { property: 'name', value: 'Thomas' },
            { property: 'surname', value: 'Voeckler' }
          ]
        }
      ]
    })

    expect(result6.violatesUniqueConstraint).toBeFalsy()
  })

  test('CRUD', async () => {
    expect.assertions(184)

    const result1A = await conn.db(db1).create(CONST.userCollection, {
      name: 'Daryl',
      surname: 'Impey',
      country: 'South Africa',
      strength: 'All Rounder',
      _secret: 'Rusks',
      resultsV3: {
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
    expect(result1B.resultsV3[2018].length).toEqual(3)
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
    expect(result1C.resultsV3[2018].length).toEqual(3)
    expect(result1C.rating.timetrial).toEqual(8)

    const result1D = await conn.db(db1).read(CONST.userCollection, { value: 'Impey', property: 'surname' })

    expect(result1D.name).toEqual('Daryl')
    expect(result1D.surname).toEqual('Impey')
    expect(result1D._secret).toEqual('Rusks')
    expect(result1D.resultsV3[2018].length).toEqual(3)
    expect(result1D.rating.timetrial).toEqual(8)

    const result1E = await conn.db(db1).read(CONST.userCollection, { value: 'Impey', property: 'surname' }, {
      trimPrivateProps: true
    })

    expect(result1E.name).toEqual('Daryl')
    expect(result1E.surname).toEqual('Impey')
    expect(result1E._secret).toBeUndefined()
    expect(result1E.resultsV3[2018].length).toEqual(3)
    expect(result1E.rating.timetrial).toEqual(8)

    const result1F = await conn.db(db1).read(CONST.userCollection, result1A[0]._key)

    expect(result1F.name).toEqual('Daryl')
    expect(result1F.surname).toEqual('Impey')
    expect(result1F.resultsV3[2017].length).toEqual(1)
    expect(result1F.resultsV3[2018].length).toEqual(3)

    const result1GA = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'resultsV3.2017')
    expect(Array.isArray(result1GA)).toBeTruthy()
    expect(result1GA.length).toEqual(1)

    const result1GB = await conn.db(db1).fetchProperty(CONST.userCollection, result1A[0]._key, 'resultsV3.2018')
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
      resultsV3: {
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
    expect(result2B.resultsV3[2012].length).toEqual(1)
    expect(result2B.rating.sprint).toEqual(6)

    const result2C = await conn.db(db1).update(CONST.userCollection, {
      value: result2A[0]._key,
      data: {
        fame: "G'day Mate",
        strength: 'All Rounder',
        resultsV3: { 2012: ['3rd, Critérium du Dauphiné'] },
        rating: { sprint: 7 }
      }
    })

    expect(result2C[0]._key).toBeDefined()

    const result2D = await conn.db(db1).read(CONST.userCollection, { value: result2A[0]._key })

    expect(result2D.name).toEqual('Cadel')
    expect(result2D.surname).toEqual('Evans')
    expect(result2D.fame).toEqual("G'day Mate")
    expect(result2D.strength).toEqual('All Rounder')
    expect(result2D.resultsV3['2012']).toEqual(expect.arrayContaining(['3rd, Critérium du Dauphiné']))
    expect(result2D.resultsV3['2013']).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]))
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
      property: 'surname',
      value: 'Evans',
      data: {
        fame: 'Too Nice',
        strength: 'GC',
        resultsV3: { 2009: ['1st, UCI Road Race World Champs'] },
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
    expect(result2F.fame).toEqual('Too Nice')
    expect(result2F.strength).toEqual('GC')
    expect(result2F.resultsV3['2012']).toEqual(expect.arrayContaining(['3rd, Critérium du Dauphiné']))
    expect(result2F.resultsV3['2013']).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]))
    expect(result2F.resultsV3['2009']).toEqual(expect.arrayContaining(['1st, UCI Road Race World Champs']))
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
      property: 'strength',
      value: 'Time Trial',
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

    // WFC finish this
    // const result4BAlt = (await conn.db(db1)
    //   .fetchByPropertyValues(CONST.userCollection, {
    //     properties: { property: 'strength', value: 'Time Trial' },
    //     match: MatchType.ANY
    //   })) as QueryResult

    // console.log(result4BAlt)

    const rohanDennisv1 = result4B.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv1.rating.timetrial).toEqual(9)

    const result4BWithLimit1 = (await db
      .fetchByProperties(
        CONST.userCollection,
        { properties: { property: 'strength', value: 'Time Trial' } },
        { limit: 2, sortBy: 'name', sortOrder: 'descending' }
      )) as QueryResult

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
      property: 'surname',
      value: 'Dennis',
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
      .returnAll(aql`FOR d IN ${conn.col(db1, CONST.userCollection)} FILTER d.strength LIKE "Time Trial" RETURN d`)

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
      .returnAll(aql`FOR d IN ${conn.col(db1, CONST.userCollection)} FILTER d.strength LIKE "Trail Running" RETURN d`)

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
      .returnOne(aql`FOR d IN ${conn.col(db1, CONST.userCollection)} FILTER d.strength LIKE "Trail Running" RETURN d`)

    expect(result3A).toBeNull()

    const result3B = await db.fetchOneByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Trail Running' } }
    )

    expect(result3B).toBeNull()

    const result4A = await conn.db(db1)
      .returnOne(aql`FOR d IN ${conn.col(db1, CONST.userCollection)} FILTER d.strength LIKE "Time Trial" RETURN d`)

    expect(result4A).toBeDefined()
    expect(result4A.surname).toBeDefined()

    const result4B = await db.fetchOneByProperties(CONST.userCollection,
      { properties: { property: 'strength', value: 'Time Trial' } }
    )

    expect(result4B).toBeDefined()
    expect(result4B.surname).toBeDefined()

    const result5A = await conn.db(db1)
      .returnOne(aql`FOR d IN ${conn.col(db1, CONST.userCollection)} FILTER d.surname LIKE "Impey" RETURN d`)

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
      property: 'favoriteRoads.Portugal.Lisbon', value: 'sintra', options: { caseSensitive: true }
    })) as QueryResult

    expect(result1L.data.length).toEqual(0)

    const result1M = (await conn.db(db1)
      .fetchByPropertyValue(CONST.userCollection, { property: 'stats.grandTours', value: 21 }
      )) as QueryResult

    expect(result1M.data.length).toEqual(4)

    const result1N = (await conn.db(db1)
      .fetchByPropertyValue(CONST.userCollection, { property: 'stats.grandTours', value: 21, options: { caseSensitive: true } }
      )) as QueryResult

    expect(result1N.data.length).toEqual(4)
  })

  test('fetchByPropertySearch', async () => {
    const result1A = await conn.db(db1)
      // 'FOR d IN cyclists FILTER ( LIKE(d.name, "%lance%", true) || LIKE(d.name, "%chris%", true) ) RETURN d',
      // 'FOR d IN cyclists FILTER ( LIKE(d.name, "%lance%", true) || LIKE(d.name, "%chris%", true) || LIKE(d.surname, "%lance%", true) || LIKE(d.surname, "%chris%", true) ) RETURN d'
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

    // FOR d IN cyclists FILTER ( LIKE(d.name, "%%", true) ) RETURN d
    const result3A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, {
        search: {
          properties: 'name', terms: ''
        }
      }) as QueryResult

    expect(result3A.data.length).toEqual(30)
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

    const result1C = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, 'd.name == "Lance" || d.name == "Chris"', {
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

    const result2B = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection, 'LIKE(d.name, "%mar%", true) && d.strength == "Climbing"') as QueryResult

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
    // FOR d IN cyclists FILTER ( ( d.strength == "Climbing" ) || ( LIKE(d.name, "%mar%", true) ) ) RETURN d
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

    expect(result1B.data.length).toEqual(29)

    const result1BB = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength != NULL',
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

    // FOR d IN cyclists FILTER ( ( d.strength == "Zooming" ) && ( LIKE(d.name, "%mar%", true) ) ) RETURN d
    const result2AB = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength == "Zooming"',
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result2AB.data.length).toEqual(0)

    // FOR d IN cyclists FILTER ( ( d.strength != "Zooming" ) || ( LIKE(d.name, "%mar%", true) ) ) RETURN d
    const result2B = await conn.db(db1)
      .fetchByCriteria(
        CONST.userCollection,
        {
          filter: 'd.strength != "Zooming"',
          search: { properties: 'name', terms: 'mar' }
        }
      ) as QueryResult

    expect(result2B.data.length).toEqual(30)

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

    // FOR d IN cyclists FILTER ( d.strength == "Climbing" ) RETURN d
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
    // FOR d IN cyclists FILTER (
    // ( d.@p == @v ) AND
    // ( LIKE(d.name, "%mar%", true) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p == @v ) AND
    // ( LIKE(d.name, "%mar%", true) )
    // ) RETURN d
    const result1B = await conn.db(db1)
      .fetchByPropertyValueAndCriteria(
        CONST.userCollection,
        { property: 'strength', value: 'Climbing' },
        // Should work with either a string filter or criteria
        // { filter: 'LIKE(d.name, "%mar%", true)' }
        'LIKE(d.name, "%mar%", true)'
      ) as QueryResult

    expect(result1B.data.length).toEqual(2)
    expect(result1B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    // FOR d IN cyclists FILTER (
    // ( d.@p == @v ) AND
    // ( LIKE(d.name, "%mar%", true) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p == @v ) AND
    // ( ( d.surname == "Pantani" ) || ( LIKE(d.name, "%mar%", true) ) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER ( ( d.@p == @v ) AND ( ( LIKE(d.surname, "%cav%", true) ) ) ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p == @v ) AND
    // ( ( LIKE(d.surname, "%cav%", true) ) || ( LIKE(d.country, "%ia%", true) ) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p == @v ) AND
    // ( ( LIKE(d.surname, "%cav%", true) ) || ( LIKE(d.country, "%ia%", true) ) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 && d.@p2 == @v2 ) AND
    // ( ( LIKE(d.strength, "%time%", true) ) )
    // ) RETURN d

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 && d.@p2 == @v2 ) AND
    // ( LIKE(d.name, "%aint%", true) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 || d.@p2 == @v2 ) AND
    // ( ( LIKE(d.strength, "%time%", true) ) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 || d.@p2 == @v2 ) AND
    // ( LIKE(d.strength, "%time%", true) )
    // ) RETURN d
    const result2F = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        { filter: 'LIKE(d.strength, "%time%", true)' }
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

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 || d.@p2 == @v2 || d.@p3 == @v3 ) AND
    // ( LIKE(d.country, "%ia%", true) )
    // ) RETURN d
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

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 || d.@p2 == @v2 || d.@p3 == @v3 ) AND
    // ( ( LIKE(d.surname, "%cav%", true) ) || ( LIKE(d.country, "%ia%", true) ) )
    // ) RETURN d
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
          search: { properties: 'fame', terms: 'do it all' }
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
          search: { properties: 'fame', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2N.data.length).toEqual(0)

    // FOR d IN cyclists FILTER (
    // ( d.@p1 == @v1 || d.@p2 == @v2 ) AND
    // ( LIKE(d.fame, "%Train%", true) )
    // ) RETURN d
    const result2P = await conn.db(db1)
      .fetchByAnyPropertyValueAndCriteria(
        CONST.userCollection,
        [
          { property: 'country', value: 'Slovenia' },
          { property: 'strength', value: 'Classics' }
        ],
        {
          search: { properties: 'fame', terms: 'do it all' }
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
          search: { properties: 'fame', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2Q.data.length).toEqual(0)
  })

  test('Array Search', async () => {
    const result1A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        '"2024, Castellon Gravel Race, 1st" IN d.resultsV2'
      ) as QueryResult

    expect(result1A.data.length).toEqual(1)
    expect(result1A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    // FOR d IN cyclists FILTER ( LIKE(TO_STRING(d.resultsV2), "%Gravel%", true) ) RETURN d
    const result2A = await conn.db(db1)
      .fetchByCriteria(CONST.userCollection,
        'LIKE(TO_STRING(d.resultsV2), "%Gravel%", true)'
      ) as QueryResult

    expect(result2A.data.length).toEqual(4)
    expect(result2A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' }),
        expect.objectContaining({ name: 'Mathieu', surname: 'van der Poel' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Matt', surname: 'Beers' })
      ])
    )
  })

  // test('Delete database', async () => {
  //   expect.assertions(5)

  //   await conn.system.dropDatabase(db1)
  //   await conn.system.dropDatabase(db2)

  //   const testDB1Exists = await conn.db(db1).dbExists()
  //   const db2Exists = await conn.db(db2).dbExists()

  //   expect(testDB1Exists).toBeFalsy()
  //   expect(db2Exists).toBeFalsy()

  //   try {
  //     await conn.system.dropDatabase(db1)
  //   } catch (e) {
  //     expect(e.response.body.code).toEqual(404)
  //     expect(e.response.body.errorNum).toEqual(1228)
  //     expect(e.response.body.errorMessage).toEqual('database not found')
  //   }
  // })
})

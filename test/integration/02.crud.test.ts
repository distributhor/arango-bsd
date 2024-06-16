/* eslint-disable jest/no-conditional-expect */
import { ArangoConnection, ArangoDB } from '../../src/index'
import { QueryResult } from '../../src/types'

import { VAR } from './jest.shared'

const conn = new ArangoConnection([{
  databaseName: VAR.dbName,
  url: VAR.dbUrl,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}], { printQueries: false, debugFilters: false })

const db = new ArangoDB({
  databaseName: VAR.dbName,
  url: VAR.dbUrl,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}, { printQueries: false })

describe('Guacamole Integration Tests', () => {
  test('Unique constraint validation', async () => {
    expect.assertions(23)

    // should be case insensitive PT1
    // FOR d IN @@value0 FILTER ( LOWER(d.@value1) == @value2 ) RETURN d._key
    // bindVars: { '@value0': 'cyclists', value1: 'trademark', value2: 'Live Strong' }
    const result1 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        singular: {
          property: 'trademark', value: 'livestrong'
        }
      })

    expect(result1.violatesUniqueConstraint).toBeTruthy()

    // should be case insensitive PT2
    const result1DifferentCase1 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        singular: {
          property: 'trademark', value: 'LIVESTRONG'
        }
      })

    expect(result1DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    // should be case sensitive
    const result1DifferentCase2 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        singular: {
          property: 'trademark', value: 'LiveStrong', caseSensitive: true
        }
      })

    expect(result1DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result2 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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
    const result3 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        singular: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'Armstrong' }
        ]
      })

    expect(result3.violatesUniqueConstraint).toBeTruthy()

    const result3DifferentCase1 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        singular: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'ArmSTRONG' }
        ]
      })

    expect(result3DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    const result3DifferentCase2 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        singular: [
          { property: 'trademark', value: 'TORNADO', caseSensitive: true },
          { property: 'surname', value: 'ArmSTRONG', caseSensitive: true }
        ]
      })

    expect(result3DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result4 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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
    const result5 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        composite: [
          { property: 'trademark', value: 'Yellow' },
          { property: 'surname', value: 'Voeckler' }
        ]
      })

    expect(result5.violatesUniqueConstraint).toBeFalsy()

    const result5DifferentCase1 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        composite: [
          { property: 'name', value: 'THOMAS' },
          { property: 'surname', value: 'DE Gendt' }
        ]
      })

    expect(result5DifferentCase1.violatesUniqueConstraint).toBeTruthy()

    const result5DifferentCase2 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
      {
        composite: [
          { property: 'name', value: 'THOMAS', caseSensitive: true },
          { property: 'surname', value: 'DE Gendt', caseSensitive: true }
        ]
      })

    expect(result5DifferentCase2.violatesUniqueConstraint).toBeFalsy()

    const result6 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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
    const result7 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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

    const result8 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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

    const result9 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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
    const result10 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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

    const result11 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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

    const result12 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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

    const thomas = await conn.db(VAR.dbName).fetchOneByPropertyValue(
      VAR.cyclistCollection,
      { property: 'surname', value: 'de Gendt' }
    )

    // FOR d IN @@value0 FILTER (d._key != @value1) FILTER (
    //   ( LOWER(d.@value2) == @value3 && LOWER(d.@value4) == @value5 ) || LOWER(d.@value6) == @value7 || LOWER(d.@value6) == @value8
    // ) RETURN d._key
    const result13 = await conn.db(VAR.dbName).validateUniqueConstraint(
      VAR.cyclistCollection,
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

    try {
      await conn.db(VAR.dbName).validateUniqueConstraint(
        VAR.cyclistCollection,
        {
          singular: []
        })
    } catch (e) {
      expect(e.message).toEqual('No unique constraints specified')
    }

    try {
      await conn.db(VAR.dbName).validateUniqueConstraint(
        VAR.cyclistCollection,
        {
          composite: undefined
        })
    } catch (e) {
      expect(e.message).toEqual('No unique constraints specified')
    }

    try {
      await conn.db(VAR.dbName).validateUniqueConstraint(VAR.cyclistCollection, {})
    } catch (e) {
      expect(e.message).toEqual('No unique constraints specified')
    }

    try {
      await conn.db(VAR.dbName).validateUniqueConstraint(
        VAR.cyclistCollection,
        {
          singular: [],
          composite: undefined
        })
    } catch (e) {
      expect(e.message).toEqual('No unique constraints specified')
    }
  })

  test('CRUD', async () => {
    expect.assertions(199)

    const result1A = await conn.db(VAR.dbName).create(VAR.cyclistCollection, {
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
    expect(result1A.length).toEqual(1)
    expect(result1A[0]._key).toBeDefined()

    const result1B = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })

    expect(result1B.name).toEqual('Daryl')
    expect(result1B.surname).toEqual('Impey')
    expect(result1B._secret).toEqual('Rusks')
    expect(result1B.year[2018].length).toEqual(3)
    expect(result1B.rating.timetrial).toEqual(8)

    // interface Person {
    //   name: string
    // }
    // const result1C = await conn.db(VAR.dbName).read<Person>(

    const result1C = await conn.db(VAR.dbName).read(VAR.cyclistCollection, result1A[0]._key, {
      stripPrivateProps: true
    })

    expect(result1C.name).toEqual('Daryl')
    expect(result1C.surname).toEqual('Impey')
    expect(result1C._secret).toBeUndefined()
    expect(result1C.year[2018].length).toEqual(3)
    expect(result1C.rating.timetrial).toEqual(8)

    const result1C2 = await conn.db(VAR.dbName).read(VAR.cyclistCollection, result1A[0]._key, {
      keep: 'favoriteRoads'
    })

    expect(result1C2.name).toBeUndefined()
    expect(result1C2.surname).toBeUndefined()
    expect(result1C2.favoriteRoads).toBeDefined()
    expect(Object.keys(result1C2).length).toEqual(1)

    const result1CD = await conn.db(VAR.dbName).read(VAR.cyclistCollection, result1A[0]._key, {
      keep: ['_key', 'name', 'favoriteRoads']
    })

    expect(result1CD._key).toBeDefined()
    expect(result1CD.name).toBeDefined()
    expect(result1CD.surname).toBeUndefined()
    expect(result1CD.favoriteRoads).toBeDefined()
    expect(Object.keys(result1CD).length).toEqual(3)

    const result1D = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: 'Impey', property: 'surname' })

    expect(result1D.name).toEqual('Daryl')
    expect(result1D.surname).toEqual('Impey')
    expect(result1D._secret).toEqual('Rusks')
    expect(result1D.year[2018].length).toEqual(3)
    expect(result1D.rating.timetrial).toEqual(8)

    const result1E = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: 'Impey', property: 'surname' }, {
      stripPrivateProps: true
    })

    expect(result1E.name).toEqual('Daryl')
    expect(result1E.surname).toEqual('Impey')
    expect(result1E._secret).toBeUndefined()
    expect(result1E.year[2018].length).toEqual(3)
    expect(result1E.rating.timetrial).toEqual(8)

    const result1F = await conn.db(VAR.dbName).read(VAR.cyclistCollection, result1A[0]._key)

    expect(result1F.name).toEqual('Daryl')
    expect(result1F.surname).toEqual('Impey')
    expect(result1F.year[2017].length).toEqual(1)
    expect(result1F.year[2018].length).toEqual(3)

    const result1GA = await conn.db(VAR.dbName).fetchProperty(VAR.cyclistCollection, result1A[0]._key, 'year.2017')
    expect(Array.isArray(result1GA)).toBeTruthy()
    expect(result1GA.length).toEqual(1)

    const result1GB = await conn.db(VAR.dbName).fetchProperty(VAR.cyclistCollection, result1A[0]._key, 'year.2018')
    expect(Array.isArray(result1GB)).toBeTruthy()
    expect(result1GB.length).toEqual(3)

    const result1GC = await conn.db(VAR.dbName).fetchProperty(VAR.cyclistCollection, result1A[0]._key, 'country')
    expect(result1GC).toEqual('South Africa')

    const result1GD = await conn.db(VAR.dbName).fetchProperty(VAR.cyclistCollection, result1A[0]._key, 'favoriteRoads')
    expect(result1GD).toBeDefined()
    expect(result1GD.SouthAfrica).toBeDefined()

    const result1GE = await conn.db(VAR.dbName).fetchProperty(VAR.cyclistCollection, result1A[0]._key, 'blah')
    expect(result1GE).toBeUndefined()

    const result1HA = await conn.db(VAR.dbName).addArrayValue(VAR.cyclistCollection, result1A[0]._key, 'blah', 'one')
    const result1HB = await conn.db(VAR.dbName).addArrayValue(VAR.cyclistCollection, result1A[0]._key, 'blah', 2)
    const result1HC = await conn.db(VAR.dbName).addArrayValue(VAR.cyclistCollection, result1A[0]._key, 'nested.blah', 'one')
    const result1HD = await conn.db(VAR.dbName).addArrayValue(VAR.cyclistCollection, result1A[0]._key, 'nested.blah', 2)

    try {
      await conn.db(VAR.dbName).addArrayValue(VAR.cyclistCollection, result1A[0]._key, 'country', 'Australia')
    } catch (e) {
      expect(e.message).toEqual('Cannot add array value to an existing field that is not already of type array')
    }

    expect(result1HA[0].blah).toBeDefined()
    expect(result1HB[0].blah).toBeDefined()
    expect(result1HC[0].nested).toBeDefined()
    expect(result1HD[0].nested).toBeDefined()

    const result1J = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })
    expect(result1J.blah.length).toBe(2)
    expect(result1J.blah[0]).toBe('one')
    expect(result1J.nested.blah.length).toBe(2)
    expect(result1J.nested.blah[1]).toBe(2)

    const result1KA = await conn.db(VAR.dbName).removeArrayValue(VAR.cyclistCollection, result1A[0]._key, 'blah', 'one')
    const result1KB = await conn.db(VAR.dbName).removeArrayValue(VAR.cyclistCollection, result1A[0]._key, 'nested.blah', 2)
    const result1KC = await conn.db(VAR.dbName).removeArrayValue(VAR.cyclistCollection, result1A[0]._key, 'bleh', 'one')

    try {
      await conn.db(VAR.dbName).removeArrayValue(VAR.cyclistCollection, result1A[0]._key, 'country', 'South Africa')
    } catch (e) {
      expect(e.message).toEqual('Cannot remove array value from an existing field that is not already of type array')
    }

    expect(result1KA).not.toBeNull()
    expect(result1KB).not.toBeNull()
    expect(result1KC).toBeNull()

    const result1L = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })
    expect(result1L.blah.length).toBe(1)
    expect(result1L.blah[0]).toBe(2)
    expect(result1L.nested.blah.length).toBe(1)
    expect(result1L.nested.blah[0]).toBe('one')
    expect(result1L.bleh).toBeUndefined()
    expect(result1L.country).toBe('South Africa')

    const result1MA = await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', { id: 'a', val: 'one' }, 'id')
    const result1MB = await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', { id: 'b', val: 2 }, 'id')
    const result1MC = await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', { id: 'a', val: 'one' }, 'id')
    const result1MD = await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', { id: 'b', val: 2 }, 'id')

    // add an array object without specifying a unique object field, should result in the object being added,
    // even though there is an existing object with the same id
    const result1ME = await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', { id: 'b', val: '3.0' })

    expect(result1MA).not.toBeNull()
    expect(result1MB).not.toBeNull()
    expect(result1MC).not.toBeNull()
    expect(result1MD).not.toBeNull()
    expect(result1ME).not.toBeNull()

    try {
      await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', { id: 'a', val: 'three' }, 'idz')
    } catch (e) {
      expect(e.message).toEqual("The array object must be unique, no 'uniqueObjectField' was provided, or the array object is missing that field")
    }

    try {
      await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', { idz: 'a', val: 'three' }, 'id')
    } catch (e) {
      expect(e.message).toEqual("The array object must be unique, no 'uniqueObjectField' was provided, or the array object is missing that field")
    }

    try {
      await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', { id: 'b', val: 'three' }, 'id')
    } catch (e) {
      expect(e.message).toEqual('The array object being added is not unique')
    }

    try {
      await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', { id: 'a', val: 3 }, 'id')
    } catch (e) {
      expect(e.message).toEqual('The array object being added is not unique')
    }

    try {
      await conn.db(VAR.dbName).addArrayObject(VAR.cyclistCollection, result1A[0]._key, 'country', { id: 'z', val: 'Australia' }, 'id')
    } catch (e) {
      expect(e.message).toEqual('Cannot add array value to an existing field that is not already of type array')
    }

    const result1N = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })

    expect(result1N.oblah.length).toEqual(3)
    expect(result1N.nested.oblah.length).toEqual(2)

    const result1PA = await conn.db(VAR.dbName).removeArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', 'id', 'b')
    const result1PB = await conn.db(VAR.dbName).removeArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', 'id', 'a')
    const result1PC = await conn.db(VAR.dbName).removeArrayObject(VAR.cyclistCollection, result1A[0]._key, 'blah', 'idz', 'a')
    const result1PD = await conn.db(VAR.dbName).removeArrayObject(VAR.cyclistCollection, result1A[0]._key, 'blah', 'id', 'c')
    const result1PF = await conn.db(VAR.dbName).removeArrayObject(VAR.cyclistCollection, result1A[0]._key, 'bleh', 'id', 'a')

    expect(result1PA).not.toBeNull()
    expect(result1PB).not.toBeNull()
    expect(result1PC).toBeNull()
    expect(result1PD).toBeNull()
    expect(result1PF).toBeNull()

    try {
      await conn.db(VAR.dbName).removeArrayObject(VAR.cyclistCollection, result1A[0]._key, 'country', 'id', 'a')
    } catch (e) {
      expect(e.message).toEqual('Cannot remove array value from an existing field that is not already of type array')
    }

    const result1Q = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })

    expect(result1Q.oblah.length).toEqual(1)
    expect(result1Q.oblah[0].id).toEqual('a')
    expect(result1Q.oblah[0].val).toEqual('one')
    expect(result1Q.nested.oblah.length).toEqual(1)
    expect(result1Q.nested.oblah[0].id).toEqual('b')
    expect(result1Q.nested.oblah[0].val).toEqual(2)

    const result1RA = await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', 'id', 'a', {
      val: 'AAA'
    })

    const result1RB = await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', 'id', 'b', {
      val: 33
    })

    expect(result1RA).not.toBeNull()
    expect(result1RB).not.toBeNull()

    const result1RC = await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'foo', 'id', 'a', {
      val: 'XYZ'
    })

    const result1RE = await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', 'id', 'x', {
      val: 'ZZZ'
    })

    expect(result1RC).toBeNull()
    expect(result1RE).toBeNull()

    const result1S = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })

    expect(result1S.foo).toBeUndefined()
    expect(result1S.oblah.length).toEqual(1)
    expect(result1S.oblah[0].id).toEqual('a')
    expect(result1S.oblah[0].val).toEqual('AAA')
    expect(result1S.oblah[0].message).toBeUndefined()
    expect(result1S.nested.oblah.length).toEqual(1)
    expect(result1S.nested.oblah[0].id).toEqual('b')
    expect(result1S.nested.oblah[0].val).toEqual(33)

    const result1TA = await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'foo', 'id', 'a', {
      val: 'XYZ'
    }, { addIfNotFound: true })

    const result1TB = await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', 'id', 'x', {
      id: 'x',
      val: 'ZZZ'
    }, { addIfNotFound: true })

    expect(result1TA).not.toBeNull()
    expect(result1TB).not.toBeNull()

    // confirm the merging of objects work
    await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'oblah', 'id', 'a', {
      message: 'Hello World'
    })

    // confirm that replacing an entire array object works
    await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', 'id', 'b', {
      message: 'Replaced'
    }, { strategy: 'replace' })

    try {
      await conn.db(VAR.dbName).updateArrayObject(VAR.cyclistCollection, result1A[0]._key, 'country', 'id', 'a', {
        val: 'Australia'
      })
    } catch (e) {
      expect(e.message).toEqual('Cannot update array value from an existing field that is not already of type array')
    }

    const result1U = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })

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
    await conn.db(VAR.dbName).replaceArrayObject(VAR.cyclistCollection, result1A[0]._key, 'nested.oblah', 'id', 'b', {
      msg: 'Replaced Again!',
      val: 'BLAH'
    })

    await conn.db(VAR.dbName).replaceArray(VAR.cyclistCollection, result1A[0]._key, 'blah', ['one', 'two', 'three'])
    await conn.db(VAR.dbName).replaceArray(VAR.cyclistCollection, result1A[0]._key, 'oblah', [{
      id: 123,
      text: '123'
    }, {
      id: 'ABC',
      text: 321
    }])

    const result1Z = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })

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

    const result2A = await conn.db(VAR.dbName).create(VAR.cyclistCollection, {
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
    )

    expect(result2A).toBeDefined()
    expect(result2A[0]._key).toBeDefined()

    const result2B = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result2A[0]._key })

    expect(result2B.name).toEqual('Cadel')
    expect(result2B.surname).toEqual('Evans')
    // expect(result2B._secret).toBeUndefined()
    expect(result2B.year[2012].length).toEqual(1)
    expect(result2B.rating.sprint).toEqual(6)

    const result2C = await conn.db(VAR.dbName).update(VAR.cyclistCollection, {
      key: result2A[0]._key,
      data: {
        trademark: "G'day Mate",
        strength: 'All Rounder',
        year: { 2012: ['3rd, Critérium du Dauphiné'] },
        rating: { sprint: 7 }
      }
    })

    expect(result2C.length).toEqual(1)
    expect(result2C[0]._key).toBeDefined()

    const result2Validate = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result2A[0]._key })

    expect(result2Validate.name).toEqual('Cadel')
    expect(result2Validate.surname).toEqual('Evans')
    expect(result2Validate.trademark).toEqual("G'day Mate")
    expect(result2Validate.strength).toEqual('All Rounder')
    expect(result2Validate.year['2012']).toEqual(expect.arrayContaining(['3rd, Critérium du Dauphiné']))
    expect(result2Validate.year['2013']).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]))
    expect(result2Validate.rating).toEqual(
      expect.objectContaining({
        sprint: 7,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7
      })
    )

    const result2D = await conn.db(VAR.dbName).update(VAR.cyclistCollection, [
      { _key: result1A[0]._key, yetAnotherProp: 'OK' },
      { _key: result2A[0]._key, rating: { sprint: 7.5 } }
    ])

    expect(result2D.length).toEqual(2)
    expect(result2D[0]._key).toBeDefined()

    try {
      await conn.db(VAR.dbName).update(VAR.cyclistCollection, [{ _key: '', yetAnotherProp: 'OK' }])
    } catch (e) {
      expect(e.message).toEqual('Invalid _key supplied')
    }

    const result2DValidate = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result1A[0]._key })
    expect(result2DValidate.yetAnotherProp).toEqual('OK')

    const result2E = await conn.db(VAR.dbName).update(VAR.cyclistCollection, {
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

    // console.log(result2D)
    // console.log(result2E)

    expect(result2E).toBeDefined()
    expect(Array.isArray(result2E)).toBeTruthy()
    expect(result2E.length).toEqual(1)
    expect(result2E[0]._key).toBeDefined()

    const result2F = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result2A[0]._key })

    expect(result2F.name).toEqual('Cadel')
    expect(result2F.surname).toEqual('Evans')
    expect(result2F.trademark).toEqual('Too Nice')
    expect(result2F.strength).toEqual('GC')
    expect(result2F.year['2012']).toEqual(expect.arrayContaining(['3rd, Critérium du Dauphiné']))
    expect(result2F.year['2013']).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]))
    expect(result2F.year['2009']).toEqual(expect.arrayContaining(['1st, UCI Road Race World Champs']))
    expect(result2F.rating).toEqual(
      expect.objectContaining({
        sprint: 7.5,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7,
        solo: 8
      })
    )

    const result2G = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: 'Evans', property: 'surname' })

    expect(result2G.name).toEqual('Cadel')
    expect(result2G.surname).toEqual('Evans')

    const result2H = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, { value: result2A[0]._key })

    expect(result2H[0]._key).toBeDefined()

    const result2I = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result2A[0]._key })

    expect(result2I).toBeNull()

    const result2J = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: 'Evans', property: 'surname' })

    expect(result2J).toBeNull()

    const result3A = await conn.db(VAR.dbName).create(VAR.cyclistCollection, {
      name: 'Thomas',
      surname: 'Voeckler',
      country: 'France'
    })

    expect(result3A).toBeDefined()
    expect(result3A[0]._key).toBeDefined()

    const result3B = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result3A[0]._key })

    expect(result3B.name).toEqual('Thomas')
    expect(result3B.surname).toEqual('Voeckler')

    const result3C = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, { value: 'Voeckler', property: 'surname' })

    expect(result3C).toBeDefined()
    expect(Array.isArray(result3C)).toBeTruthy()
    expect(result3C.length).toEqual(1)
    expect(result3C[0]._key).toBeDefined()

    const result3D = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { value: result3A[0]._key })

    expect(result3D).toBeNull()

    const result4A = await conn.db(VAR.dbName).update(VAR.cyclistCollection, {
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

    const result4B = (await db.fetchByProperties(VAR.cyclistCollection, {
      properties: { property: 'strength', value: 'Time Trial' }
    })) as QueryResult

    expect(result4B.data.length).toEqual(3)

    const rohanDennisv1 = result4B.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv1.rating.timetrial).toEqual(9)

    const result4BWithLimit1 = (await db
      .fetchByProperties(
        VAR.cyclistCollection,
        { properties: { property: 'strength', value: 'Time Trial' } },
        { limit: 2, sortBy: 'name', sortOrder: 'descending' }
      )) as QueryResult

    // FOR d IN @@value0 FILTER ( LOWER(d.@value1) == @value2 ) SORT d.@value3 DESC LIMIT 1, 2 RETURN d
    const result4BWithLimit2 = (await db
      .fetchByProperties(
        VAR.cyclistCollection,
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

    const result4C = await conn.db(VAR.dbName).update(VAR.cyclistCollection, {
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

    const result4D = (await conn.db(VAR.dbName)
      .fetchByPropertyValue(VAR.cyclistCollection, {
        property: 'strength', value: 'Time Trial'
      })) as QueryResult

    expect(result4D.data.length).toEqual(3)

    const rohanDennisv2 = result4D.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv2.rating.timetrial).toEqual(8)

    const result4E = await conn.db(VAR.dbName).updateProperty(VAR.cyclistCollection, rohanDennisv2._key, 'rating.timetrial', 7)

    expect(result4E).toBeDefined()
    expect(Array.isArray(result4E)).toBeTruthy()
    expect(result4E.length).toEqual(1)
    expect(result4E[0]._key).toBeDefined()
    expect(result4E[0]['rating.timetrial']).toBeDefined()

    const result4F = (await conn.db(VAR.dbName)
      .fetchByPropertyValue(VAR.cyclistCollection, {
        property: 'strength', value: 'Time Trial'
      })) as QueryResult

    expect(result4F.data.length).toEqual(3)

    const rohanDennisv3 = result4F.data.find(i => i.surname === 'Dennis')
    expect(rohanDennisv3.rating.timetrial).toEqual(7)

    const result5A = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, { property: 'strength', value: 'Break Aways' })

    expect(result5A).toBeDefined()
    expect(Array.isArray(result5A)).toBeTruthy()
    expect(result5A.length).toEqual(1)

    const result5B = (await db.fetchByProperties(VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Break Aways' } }
    )) as QueryResult

    expect(result5B.data.length).toEqual(0)
  })
})

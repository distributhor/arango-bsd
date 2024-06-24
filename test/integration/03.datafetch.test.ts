/* eslint-disable jest/no-conditional-expect */
import { aql } from 'arangojs/aql'
import { ArrayCursor } from 'arangojs/cursor'
import { ArangoConnection, ArangoDB } from '../../src/index'
import { MatchType, type QueryResult } from '../../src/types'

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
  test('query, queryOne', async () => {
    const result1A = await conn.db(VAR.dbName).return(
      aql`FOR d IN ${conn.db(VAR.dbName).collection(VAR.cyclistCollection)} FILTER d.strength LIKE "Time Trial" RETURN d`,
      { fullCount: true }
    )

    expect(result1A.data.length).toEqual(3)
    expect(result1A.data[0].surname).toBeDefined()
    expect(result1A.size).toEqual(3)
    expect(result1A.total).toEqual(3)

    const result1ALiteral = await conn
      .db(VAR.dbName)
      .return(`FOR d IN ${VAR.cyclistCollection} FILTER d.strength LIKE "Time Trial" RETURN d`)

    expect(result1ALiteral.data.length).toEqual(3)
    expect(result1ALiteral.data[0].surname).toBeDefined()

    const result1B = (await db.fetchByProperties(VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Time Trial' } }
    )) as QueryResult

    expect(result1B.data.length).toEqual(3)
    expect(result1B.data[0].name).toBeDefined()
    expect(result1B.data[0].surname).toBeDefined()
    expect(result1B.data[0]._key).toBeDefined()

    const result1C = (await db.fetchByProperties(
      VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Time Trial' } },
      {
        trim: { stripPrivateProps: true }
      }
    )) as QueryResult

    expect(result1C.data.length).toEqual(3)
    expect(result1C.data[0].name).toBeDefined()
    expect(result1C.data[0].surname).toBeDefined()
    expect(result1C.data[0]._key).toBeDefined()

    const result1D = (await db.fetchByProperties(
      VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Time Trial' } },
      {
        trim: { stripPrivateProps: true }
      }
    )) as QueryResult

    expect(result1D.data.length).toEqual(3)
    expect(result1D.data[0].name).toBeDefined()
    expect(result1D.data[0].surname).toBeDefined()
    expect(result1D.data[0]._key).toBeDefined()

    const result1E = (await db.fetchByProperties(
      VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Time Trial' } },
      { returnCursor: true }
    )) as ArrayCursor

    expect(result1E instanceof ArrayCursor).toBeTruthy()
    const allDocs = await result1E.all()
    expect(allDocs[0].surname).toBeDefined()

    const result2A = await conn.db(VAR.dbName)
      .return(aql`FOR d IN ${conn.db(VAR.dbName).collection(VAR.cyclistCollection)} FILTER d.strength LIKE "Trail Running" RETURN d`)

    expect(result2A.data).toBeDefined()
    expect(Array.isArray(result2A.data)).toBeTruthy()
    expect(result2A.data.length).toEqual(0)

    const result2B = (await db.fetchByProperties(VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Trail Running' } }
    )) as QueryResult

    expect(result2B.data).toBeDefined()
    expect(Array.isArray(result2B.data)).toBeTruthy()
    expect(result2B.data.length).toEqual(0)

    const result3A = await conn.db(VAR.dbName)
      .returnOne(aql`FOR d IN ${conn.db(VAR.dbName).collection(VAR.cyclistCollection)} FILTER d.strength LIKE "Trail Running" RETURN d`)

    expect(result3A).toBeNull()

    const result3B = await db.fetchOneByProperties(VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Trail Running' } }
    )

    expect(result3B).toBeNull()

    const result4A = await conn.db(VAR.dbName)
      .returnOne(aql`FOR d IN ${conn.db(VAR.dbName).collection(VAR.cyclistCollection)} FILTER d.strength LIKE "Time Trial" RETURN d`)

    expect(result4A).toBeDefined()
    expect(result4A.surname).toBeDefined()

    const result4B = await db.fetchOneByProperties(VAR.cyclistCollection,
      { properties: { property: 'strength', value: 'Time Trial' } }
    )

    expect(result4B).toBeDefined()
    expect(result4B.surname).toBeDefined()

    const result5A = await conn.db(VAR.dbName)
      .returnOne(aql`FOR d IN ${conn.db(VAR.dbName).collection(VAR.cyclistCollection)} FILTER d.surname LIKE "Impey" RETURN d`)

    expect(result5A).toBeDefined()
    expect(result5A.name).toEqual('Daryl')

    const result5B = await conn.db(VAR.dbName)
      .fetchOneByPropertyValue(VAR.cyclistCollection,
        { property: 'surname', value: 'Impey' }
      )

    expect(result5B).toBeDefined()
    expect(result5B.name).toEqual('Daryl')
    expect(result5B.surname).toEqual('Impey')
    expect(result5B._secret).toEqual('Rusks')
    expect(result5B._key).toBeDefined()

    const result5C = await conn.db(VAR.dbName)
      .fetchOneByPropertyValue(
        VAR.cyclistCollection,
        { property: 'surname', value: 'Impey' },
        { trim: { stripPrivateProps: true } }
      )

    expect(result5C).toBeDefined()
    expect(result5C.name).toEqual('Daryl')
    expect(result5C.surname).toEqual('Impey')
    expect(result5C._secret).toBeUndefined()
    expect(result5C._key).toBeDefined()

    const result5D = await db
      .fetchOneByProperties(
        VAR.cyclistCollection,
        { properties: { property: 'surname', value: 'Impey' } },
        { trim: { stripPrivateProps: true } }
      )

    expect(result5D).toBeDefined()
    expect(result5D.name).toEqual('Daryl')
    expect(result5D.surname).toEqual('Impey')
    expect(result5D._secret).toBeUndefined()
    expect(result5D._key).toBeDefined()
    expect(result5D.year).toBeDefined()
    expect(result5D.blah).toBeDefined()
    expect(result5D.foo).toBeDefined()

    const result5DTrimmed1 = await db
      .fetchOneByProperties(
        VAR.cyclistCollection,
        { properties: { property: 'surname', value: 'Impey' } },
        { trim: { omit: ['year', 'blah', 'foo'] } }
      )

    expect(result5DTrimmed1._secret).toBeDefined()
    expect(result5DTrimmed1.year).toBeUndefined()
    expect(result5DTrimmed1.blah).toBeUndefined()
    expect(result5DTrimmed1.foo).toBeUndefined()

    const result5DTrimmed2 = await db
      .fetchOneByProperties(
        VAR.cyclistCollection,
        { properties: { property: 'surname', value: 'Impey' } },
        { trim: { keep: ['name', 'favoriteRoads'] } }
      )

    expect(result5DTrimmed2.name).toBeDefined()
    expect(result5DTrimmed2.surname).toBeUndefined()
    expect(result5DTrimmed2.country).toBeUndefined()
    expect(result5DTrimmed2.favoriteRoads).toBeDefined()

    const result6A = (await db.fetchByProperties(VAR.cyclistCollection, {
      properties: [
        { property: 'country', value: 'Belgium' },
        { property: 'strength', value: 'Classics' }
      ],
      match: MatchType.ALL
    })) as QueryResult

    expect(result6A.data.length).toEqual(3)
    expect(result6A.data[0].name === 'Wout' || result6A.data[0].name === 'Tim' || result6A.data[0].name === 'Greg').toBeTruthy()
    expect(result6A.data[1].surname === 'van Aert' || result6A.data[1].surname === 'Wellens' || result6A.data[1].surname === 'van Avermaet').toBeTruthy()

    const result6B = (await db.fetchByProperties(VAR.cyclistCollection, {
      properties: [
        { property: 'country', value: 'UK' },
        { property: 'strength', value: 'Classics' }
      ],
      match: MatchType.ALL
    })) as QueryResult

    expect(result6B.data.length).toEqual(0)

    const result7A = await conn.db(VAR.dbName).fetchOneByAllPropertyValues(VAR.cyclistCollection,
      [
        { property: 'country', value: 'Belgium' },
        { property: 'strength', value: 'Classics' }
      ]
    )

    expect(result7A.surname === 'van Aert' || result7A.surname === 'Wellens').toBeTruthy()

    const result7B = await db.fetchOneByProperties(VAR.cyclistCollection, {
      properties: [
        { property: 'name', value: 'Jan' },
        { property: 'surname', value: 'Ullrich' }
      ],
      match: MatchType.ALL
    })

    expect(result7B.surname).toEqual('Ullrich')

    const result7C = await db.fetchOneByProperties(VAR.cyclistCollection, {
      properties: [
        { property: 'name', value: 'Jan' },
        { property: 'surname', value: 'Armstrong' }
      ],
      match: MatchType.ALL
    })

    expect(result7C).toBeNull()
  })

  test('fetchByPropertyValue', async () => {
    const result1A = (await db.fetchByProperties(VAR.cyclistCollection, {
      properties: { property: 'name', value: 'Daryl' }
    })) as QueryResult

    expect(result1A.data.length).toEqual(1)

    const result1B = (await db.fetchByProperties(VAR.cyclistCollection, {
      properties: { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
    })) as QueryResult

    expect(result1B.data.length).toEqual(1)

    const result1C = (await conn.db(VAR.dbName)
      .fetchByAllPropertyValues(VAR.cyclistCollection, [
        { property: 'favoriteRoads.SouthAfrica.CapeTown', value: 'Chapmans Peak' },
        { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
      ])) as QueryResult

    expect(result1C.data.length).toEqual(1)

    const result1D = (await conn.db(VAR.dbName)
      .fetchByAllPropertyValues(VAR.cyclistCollection, [
        { property: 'favoriteRoads.SouthAfrica.CapeTown', value: 'Chappies' },
        { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
      ])) as QueryResult

    expect(result1D.data.length).toEqual(0)

    const result1E = (await conn.db(VAR.dbName)
      .fetchByAnyPropertyValue(VAR.cyclistCollection, [
        { property: 'favoriteRoads.SouthAfrica.CapeTown', value: 'Chappies' },
        { property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra' }
      ])) as QueryResult

    expect(result1E.data.length).toEqual(1)

    const result1F = (await conn.db(VAR.dbName)
      .fetchByAnyPropertyValue(VAR.cyclistCollection, [
        { property: 'country', value: 'UK' },
        { property: 'country', value: 'Spain' }
      ])) as QueryResult

    expect(result1F.data.length).toEqual(6)

    const result1G = (await conn.db(VAR.dbName)
      .fetchByAllPropertyValues(VAR.cyclistCollection, [
        { property: 'country', value: 'UK' },
        { property: 'country', value: 'Spain' }
      ])) as QueryResult

    expect(result1G.data.length).toEqual(0)

    const result1H = (await conn.db(VAR.dbName)
      .fetchByAllPropertyValues(VAR.cyclistCollection, [
        { property: 'country', value: 'UK' },
        { property: 'strength', value: 'General Classification' }
      ])) as QueryResult

    expect(result1H.data.length).toEqual(2)

    const result1J = (await conn.db(VAR.dbName).fetchByPropertyValue(VAR.cyclistCollection, {
      property: 'favoriteRoads.Portugal.Lisbon', value: 'Sintra'
    })) as QueryResult

    expect(result1J.data.length).toEqual(1)

    const result1K = (await conn.db(VAR.dbName).fetchByPropertyValue(VAR.cyclistCollection, {
      property: 'favoriteRoads.Portugal.Lisbon', value: 'sintra'
    })) as QueryResult

    expect(result1K.data.length).toEqual(1)

    const result1L = (await conn.db(VAR.dbName).fetchByPropertyValue(VAR.cyclistCollection, {
      property: 'favoriteRoads.Portugal.Lisbon', value: 'sintra', caseSensitive: true
    })) as QueryResult

    expect(result1L.data.length).toEqual(0)

    const result1M = (await conn.db(VAR.dbName)
      .fetchByPropertyValue(VAR.cyclistCollection, { property: 'stats.grandTours', value: 21 }
      )) as QueryResult

    expect(result1M.data.length).toEqual(4)

    const result1N = (await conn.db(VAR.dbName)
      .fetchByPropertyValue(VAR.cyclistCollection, { property: 'stats.grandTours', value: 21, caseSensitive: true }
      )) as QueryResult

    expect(result1N.data.length).toEqual(4)
  })

  test('fetchByPropertySearch', async () => {
    expect.assertions(5)

    // FOR d IN @@value0 FILTER ( LIKE(d.@value1, @value2, true) || LIKE(d.@value1, @value3, true) ) RETURN d
    // bindVars: {
    //   '@value0': 'cyclists',
    //   value1: 'name',
    //   value2: '%lance%',
    //   value3: '%chris%'
    // }
    const result1A = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, {
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

    const result2A = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, {
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

    try {
      // FOR d IN @@value0 FILTER ( LIKE(d.@value1, @value2, true) ) RETURN d
      // bindVars: { '@value0': 'cyclists', value1: 'name', value2: '%' }
      await conn.db(VAR.dbName)
        .fetchByCriteria(VAR.cyclistCollection, {
          search: {
            properties: 'name', terms: ''
          }
        }, { printQuery: true }) as QueryResult

      // expect(result3A.data.length).toEqual(31)
    } catch (e) {
      expect(e.message).toEqual('No filters received for valid query construction')
    }
  })

  test('fetchByFilters', async () => {
    const result1A = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, 'd.name == "Lance" || d.name == "Chris"') as QueryResult

    expect(result1A.data.length).toEqual(2)
    expect(result1A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Chris', surname: 'Froome' })
      ])
    )

    const result1B = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, {
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

    const result1C = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, aql`d.name == ${lance} || d.name == ${chris}`, {
        returnCursor: true
      }) as ArrayCursor

    expect(result1C instanceof ArrayCursor).toBeTruthy()

    const result2A = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, 'LIKE(d.name, "%mar%", true)') as QueryResult

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

    const result2B = await conn.db(VAR.dbName).fetchByCriteria(VAR.cyclistCollection,
      aql`LIKE(d.name, ${likeMar}, true) && d.strength == ${climbing}`
    ) as QueryResult

    expect(result2B.data.length).toEqual(2)
    expect(result2B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const result2C = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, {
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

    const result2D = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, {
        filter: {
          filters: ['LIKE(d.name, "%mar%", true)', 'd.strength == "Climbing"'],
          match: MatchType.ANY
        }
      }, { trim: { omit: 'country' } }) as QueryResult

    expect(result2D.data.length).toEqual(3)
    expect(result2D.data[0].name).toBeDefined()
    expect(result2D.data[0].results).toBeDefined()
    expect(result2D.data[0].country).toBeUndefined()
    expect(result2D.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marco', surname: 'Pantani' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' })
      ])
    )

    const result2DTrimmed2 = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, {
        filter: {
          filters: ['LIKE(d.name, "%mar%", true)', 'd.strength == "Climbing"'],
          match: MatchType.ANY
        }
      }, { trim: { omit: ['country', 'results'] } }) as QueryResult

    expect(result2DTrimmed2.data[0].name).toBeDefined()
    expect(result2DTrimmed2.data[0].results).toBeUndefined()
    expect(result2DTrimmed2.data[0].country).toBeUndefined()

    // const result2B = await conn.db(VAR.dbName)
    //   .fetchByFilterCriteria(VAR.cyclistCollection, 'name LIKE "%mar%"') as QueryResult // does not return a result
    // // .fetchByFilterCriteria(VAR.cyclistCollection, 'name LIKE "lance"') as QueryResult // does return a result

    const result3A = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection, 'd.country == "Italy" && d.strength == "General Classification"') as QueryResult

    expect(result3A.data.length).toEqual(2)
    expect(result3A.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )
  })

  test('fetchByCriteria', async () => {
    const result1A = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
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

    const result1AB = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
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

    const result1B = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
        {
          filter: 'd.strength != NULL',
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ANY
        }
      ) as QueryResult

    expect(result1B.data.length).toEqual(30)

    const none = 'NULL'

    const result1BB = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
        {
          filter: aql`d.strength != ${none}`,
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1BB.data.length).toEqual(3)

    const result2A = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
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
    const result2AB = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
        {
          filter: aql`d.strength == ${zoom}`,
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result2AB.data.length).toEqual(0)

    const result2B = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
        {
          filter: 'd.strength != "Zooming"',
          search: { properties: 'name', terms: 'mar' }
        }
      ) as QueryResult

    expect(result2B.data.length).toEqual(31)

    // FOR d IN cyclists FILTER ( ( d.strength != "Zooming" ) && ( LIKE(d.name, "%mar%", true) ) ) RETURN d
    const result2BB = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
        {
          filter: 'd.strength != "Zooming"',
          search: { properties: 'name', terms: 'mar' },
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result2BB.data.length).toEqual(3)

    // FOR d IN @@value0 FILTER ( d.strength == "Climbing" ) RETURN d
    const result3A = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
        {
          filter: 'd.strength == "Climbing"'
        }
      ) as QueryResult

    expect(result3A.data.length).toEqual(2)

    // FOR d IN cyclists FILTER ( LIKE(d.name, "%mar%", true) ) RETURN d
    const result4A = await conn.db(VAR.dbName)
      .fetchByCriteria(
        VAR.cyclistCollection,
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
        VAR.cyclistCollection,
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
    const result1B = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
    const result1C = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
    // const result1D = await conn.db(VAR.dbName)
    //   .fetchByPropertyValueAndCriteria(
    //     VAR.cyclistCollection,
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
        VAR.cyclistCollection,
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
        VAR.cyclistCollection,
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
    //     VAR.cyclistCollection,
    //     { property: 'strength', value: 'Sprinter' },
    //     { search: { properties: 'country', terms: 'ia' } }
    //   ) as QueryResult

    const result1K = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
        VAR.cyclistCollection,
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
        VAR.cyclistCollection,
        { properties: { property: 'strength', value: 'Sprinter' } },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%cav%", true)',
          match: MatchType.ANY
        },
        { trim: { keep: ['name', 'surname', 'country'] } }
      ) as QueryResult

    expect(result1M.data.length).toEqual(3)
    expect(result1M.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter', surname: 'Sagan', country: 'Slovakia' }),
        expect.objectContaining({ name: 'Caleb', surname: 'Ewan', country: 'Australia' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish', country: 'UK' })
      ])
    )
    expect(result1M.data[0].results).toBeUndefined()
    expect(result1M.data[0].stats).toBeUndefined()

    const result1MTrimmed1 = await db
      .fetchByPropertiesAndCriteria(
        VAR.cyclistCollection,
        { properties: { property: 'strength', value: 'Sprinter' } },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%cav%", true)',
          match: MatchType.ANY
        },
        { trim: { keep: 'name' } }
      ) as QueryResult

    expect(result1MTrimmed1.data[0].results).toBeUndefined()
    expect(result1MTrimmed1.data[0].surname).toBeUndefined()
    expect(result1MTrimmed1.data.length).toEqual(3)
    expect(result1MTrimmed1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Peter' }),
        expect.objectContaining({ name: 'Caleb' }),
        expect.objectContaining({ name: 'Mark' })
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
    const result1N = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
        { property: 'strength', value: 'Sprinter' },
        {
          search: { properties: 'country', terms: 'ia' },
          filter: 'LIKE(d.surname, "%cav%", true)',
          match: MatchType.ALL
        }
      ) as QueryResult

    expect(result1N.data.length).toEqual(0)

    const result1P = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
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

    const result200A = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
        { property: 'strength', value: 'Zooming' },
        { search: { properties: 'name', terms: 'mar' } }
      ) as QueryResult

    expect(result200A.data.length).toEqual(0)

    const result3A = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
    const result2A = await conn.db(VAR.dbName).fetchByAnyPropertyValueAndCriteria(
      VAR.cyclistCollection,
      [
        { property: 'country', value: 'UK' },
        { property: 'strength', value: 'General Classification' }
      ],
      { search: { properties: 'name', terms: 'aint' } }
    ) as QueryResult

    // const Z = await conn.db(VAR.dbName)
    //   .fetchByAllPropertyValuesAndCriteria(
    //     VAR.cyclistCollection,
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
      VAR.cyclistCollection, {
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
      VAR.cyclistCollection, {
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
      VAR.cyclistCollection, {
        properties: [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        match: MatchType.ANY
      },
      { search: { properties: 'strength', terms: 'time' } }
    ) as QueryResult

    expect(result2D.data.length).toEqual(2)

    // const result3D = await conn.db(VAR.dbName)
    //   .fetchByPropertyValuesAndCriteria(
    //     VAR.cyclistCollection,
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

    const result2E = await conn.db(VAR.dbName)
      .fetchByAllPropertyValuesAndCriteria(
        VAR.cyclistCollection,
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
    const result2F = await conn.db(VAR.dbName)
      .fetchByAnyPropertyValueAndCriteria(
        VAR.cyclistCollection,
        [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        { filter: aql`LIKE(d.strength, ${likeTime}, true)` }
      ) as QueryResult

    expect(result2F.data.length).toEqual(2)

    const result2G = await conn.db(VAR.dbName)
      .fetchByAnyPropertyValueAndCriteria(
        VAR.cyclistCollection,
        [
          { property: 'country', value: 'Germany' },
          { property: 'country', value: 'Switzerland' }
        ],
        { filter: { filters: ['LIKE(d.strength, "%time%", true)'] } }
      ) as QueryResult

    expect(result2G.data.length).toEqual(2)

    // Should throw an error, criteria is missing
    // const result2H = await conn.db(VAR.dbName)
    //   .fetchByAllPropertyValuesAndCriteria(
    //     VAR.cyclistCollection,
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
    const result2J = await conn.db(VAR.dbName)
      .fetchByAnyPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
    const result2K = await conn.db(VAR.dbName)
      .fetchByAnyPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
        VAR.cyclistCollection, {
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

    const result2M = await conn.db(VAR.dbName)
      .fetchByAllPropertyValuesAndCriteria(
        VAR.cyclistCollection,
        [
          { property: 'country', value: 'Belgium' },
          { property: 'strength', value: 'Classics' }
        ],
        {
          search: { properties: 'trademark', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2M.data.length).toEqual(1)

    const result2N = await conn.db(VAR.dbName)
      .fetchByAllPropertyValuesAndCriteria(
        VAR.cyclistCollection,
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
    const result2P = await conn.db(VAR.dbName)
      .fetchByAnyPropertyValueAndCriteria(
        VAR.cyclistCollection,
        [
          { property: 'country', value: 'Slovenia' },
          { property: 'strength', value: 'Classics' }
        ],
        {
          search: { properties: 'trademark', terms: 'do it all' }
        }
      ) as QueryResult

    expect(result2P.data.length).toEqual(1)

    const result2Q = await conn.db(VAR.dbName)
      .fetchByAnyPropertyValueAndCriteria(
        VAR.cyclistCollection,
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
    const result1B = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
        '"2024, Castellon Gravel Race, 1st" IN d.results.list'
      ) as QueryResult

    expect(result1B.data.length).toEqual(1)
    expect(result1B.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    // FOR d IN @@value0 FILTER ( LIKE(TO_STRING(d.results.list), "%Gravel%", true) ) RETURN d
    const result2A = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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
    const result2B = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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
    const result2C = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
        aql`LIKE(d.${resultsProp}.${yearProp}.${year2015}, ${containsTirreno}, true)`
      ) as QueryResult

    expect(result2C.data.length).toEqual(2)
    expect(result2C.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' })
      ])
    )

    const result2D = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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
    const result2E = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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
    const result2F = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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

    const result2G = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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
    const result2H = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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

    const palmaresProp = 'results.palmares'

    // FOR d IN @@value0 FILTER ( LIKE(d.@value1, @value2, true) || LIKE(d.@value1, @value3, true) ) RETURN d
    // bindVars: {
    //   value1: 'palmares',
    //   value2: '%Waffle%',
    //   value3: '%12th%'
    // }
    const result2J = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
        { search: { properties: palmaresProp, terms: ['Waffle', '12th'] } }
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

    const result2K = await conn.db(VAR.dbName)
      .fetchByCriteria(VAR.cyclistCollection,
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
    const result2L = await conn.db(VAR.dbName)
      .fetchByPropertyValueAndCriteria(VAR.cyclistCollection,
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
})

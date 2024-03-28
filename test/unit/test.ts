// import { ListOfFilters, MatchType, QueryType } from '../../src'
import {
  // fetchByPropertyValue,
  // fetchByCompositeValue,
  // findByFilterCriteria,
  // uniqueConstraintQuery,
  _findAllIndicesOfSubString,
  _prefixPropertyNames
} from '../../src/queries'

describe('Queries', () => {
  test('Find all indices of substring in string', () => {
    const str = ' LIKE("carrot", "ca%t") && name == "wk" || ( age == 42 && speciality != "timetrial"'

    const result1 = _findAllIndicesOfSubString(['||', '&&', 'OR', 'LIKE', '!=', '=='], str)
    const result2 = _findAllIndicesOfSubString('||', str)
    const result3 = _findAllIndicesOfSubString('&&', str)

    expect(result1).toEqual(
      expect.arrayContaining([
        { index: 1, value: 'like' },
        { index: 24, value: '&&' },
        { index: 32, value: '==' },
        { index: 40, value: '||' },
        { index: 49, value: '==' },
        { index: 55, value: '&&' },
        { index: 69, value: '!=' }
      ])
    )
    expect(result2).toEqual(expect.arrayContaining([{ index: 40, value: '||' }]))
    expect(result3).toEqual(
      expect.arrayContaining([
        { index: 24, value: '&&' },
        { index: 55, value: '&&' }
      ])
    )

    expect(str.indexOf('||')).toEqual(40)
    expect(str.indexOf('&&')).toEqual(24)
    expect(str.indexOf('&&', 25)).toEqual(55)
    expect(str.indexOf('LIKE')).toEqual(1)
    expect(str.indexOf('!=')).toEqual(69)
    expect(str.indexOf('==')).toEqual(32)
    expect(str.indexOf('==', 33)).toEqual(49)
  })

  test('Prefix property name in filter string', () => {
    const filter1 = 'name == "Thomas"'
    const filter2 = 'name == "Thomas" && age == 42'
    const filter3 = 'LIKE(name, "%thomas%", true)'
    const filter4 = 'LIKE(name, "%thomas%", true) || age IN arr'
    const filter5 = 'LIKE(name, "%thomas%", true) || age IN_PROP arr'
    const filter6 = '(name == "Thomas" && age == 42) || name == "Lance"'
    const filter7 = '(name == "Thomas" && age == 42) || (name == "Lance" && surname == "Armstrong")'
    // const filter8 = '(name == "Thomas" AND age == 42) OR (name == "Lance" AND surname == "Armstrong")';
    // const filter9 = '(name == "Thomas" and age == 42) or (name == "Lance" and surname == "Armstrong")';
    const filter10 = 'name IN ["Thomas","Lance"] && (age > 42 || speciality != "timetrial")'

    const result1 = _prefixPropertyNames(filter1)
    const result2 = _prefixPropertyNames(filter2)
    const result3 = _prefixPropertyNames(filter3)
    const result4 = _prefixPropertyNames(filter4)
    const result5 = _prefixPropertyNames(filter5)
    const result6 = _prefixPropertyNames(filter6)
    const result7 = _prefixPropertyNames(filter7)
    // const result8 = _prefixPropertyNames(filter8);
    // const result9 = _prefixPropertyNames(filter9);
    const result10 = _prefixPropertyNames(filter10)

    expect(result1).toEqual('d.name == "Thomas"')
    expect(result2).toEqual('d.name == "Thomas" && d.age == 42')
    expect(result3).toEqual('LIKE(d.name, "%thomas%", true)')
    expect(result4).toEqual('LIKE(d.name, "%thomas%", true) || d.age IN arr')
    expect(result5).toEqual('LIKE(d.name, "%thomas%", true) || age IN d.arr')
    expect(result6).toEqual('(d.name == "Thomas" && d.age == 42) || d.name == "Lance"')
    expect(result7).toEqual('(d.name == "Thomas" && d.age == 42) || (d.name == "Lance" && d.surname == "Armstrong")')
    // expect(result8).toEqual('(d.name == "Thomas" AND d.age == 42) OR (d.name == "Lance" AND d.surname == "Armstrong")');
    // expect(result9).toEqual('(d.name == "Thomas" and d.age == 42) or (d.name == "Lance" and d.surname == "Armstrong")');
    expect(result10).toEqual('d.name IN ["Thomas","Lance"] && (d.age > 42 || d.speciality != "timetrial")')
  })

  // test('Find by filter criteria', async () => {
  //   const filter1 = '(name == "Thomas" && age == 42) || name == "Lance"'
  //   const filter2 = '(name == "Thomas" && age == 42) || (name == "Lance" && surname == "Armstrong")'
  //   const filter3 = 'LIKE(name, "%thomas%", true) || age IN arr'
  //   const filter4 = 'name IN ["Thomas","Lance"] && (age > 42 || speciality != "timetrial")'

  //   const filterA = '(d.name == "Thomas" && d.age == 42) || d.name == "Lance"'
  //   const filterB = '(d.name == "Thomas" && d.age == 42) || (d.name == "Lance" && d.surname == "Armstrong")'
  //   const filterC = 'LIKE(d.name, "%thomas%", true) || d.age IN arr'
  //   const filterD = 'd.name IN ["Thomas","Lance"] && (d.age > 42 || d.speciality != "timetrial")'

  //   const result1 = findByFilterCriteria(
  //     'col',
  //     filter1,
  //     {
  //       prefixPropertyNames: true
  //     },
  //     QueryType.STRING
  //   ) as string

  //   const result2 = findByFilterCriteria(
  //     'col',
  //     filter2,
  //     {
  //       prefixPropertyNames: true
  //     },
  //     QueryType.STRING
  //   ) as string

  //   const result3 = findByFilterCriteria(
  //     'col',
  //     filter3,
  //     {
  //       prefixPropertyNames: true
  //     },
  //     QueryType.STRING
  //   ) as string

  //   const result4 = findByFilterCriteria(
  //     'col',
  //     filter4,
  //     {
  //       prefixPropertyNames: true
  //     },
  //     QueryType.STRING
  //   ) as string

  //   expect(result1.includes(filterA)).toBeTruthy()
  //   expect(result2.includes(filterB)).toBeTruthy()
  //   expect(result3.includes(filterC)).toBeTruthy()
  //   expect(result4.includes(filterD)).toBeTruthy()

  //   const result6 = findByFilterCriteria('col', filterA, undefined, QueryType.STRING)
  //   const result7 = findByFilterCriteria('col', filterB, undefined, QueryType.STRING)
  //   const result8 = findByFilterCriteria('col', filterC, undefined, QueryType.STRING)
  //   const result9 = findByFilterCriteria('col', filterD, undefined, QueryType.STRING)

  //   expect(result6).toEqual(result1)
  //   expect(result7).toEqual(result2)
  //   expect(result8).toEqual(result3)
  //   expect(result9).toEqual(result4)

  //   expect(result6).toEqual(
  //     'FOR d IN col FILTER ( (d.name == "Thomas" && d.age == 42) || d.name == "Lance" ) RETURN d'
  //   )
  //   expect(result7).toEqual(
  //     'FOR d IN col FILTER ( (d.name == "Thomas" && d.age == 42) || (d.name == "Lance" && d.surname == "Armstrong") ) RETURN d'
  //   )
  //   expect(result8).toEqual('FOR d IN col FILTER ( LIKE(d.name, "%thomas%", true) || d.age IN arr ) RETURN d')
  //   expect(result9).toEqual(
  //     'FOR d IN col FILTER ( d.name IN ["Thomas","Lance"] && (d.age > 42 || d.speciality != "timetrial") ) RETURN d'
  //   )

  //   const FILTER_D: ListOfFilters = {
  //     filters: ['d.name == "Thomas"', 'd.age == 42', 'd.surname == "Armstrong"'],
  //     match: MatchType.ANY
  //   }

  //   const FILTER_E: ListOfFilters = {
  //     filters: ['name == "Thomas"', 'age == 42', 'surname == "Armstrong"'],
  //     match: MatchType.ALL
  //   }

  //   const result10 = findByFilterCriteria('col', FILTER_D, undefined, QueryType.STRING)
  //   expect(result10).toEqual(
  //     'FOR d IN col FILTER ( d.name == "Thomas" || d.age == 42 || d.surname == "Armstrong" ) RETURN d'
  //   )

  //   const result11 = findByFilterCriteria('col', FILTER_E, undefined, QueryType.STRING)
  //   expect(result11).toEqual(
  //     'FOR d IN col FILTER ( name == "Thomas" && age == 42 && surname == "Armstrong" ) RETURN d'
  //   )
  // })

  // test('Fetch by key and composite value', async () => {
  //   const result1 = fetchByPropertyValue('col', { property: 'username', value: 'ABC' }, undefined, QueryType.STRING)
  //   expect(result1).toEqual('FOR d IN col FILTER d.username == "ABC" RETURN d')

  //   const result2 = fetchByPropertyValue('col', { property: 'age', value: 42 }, undefined, QueryType.STRING)
  //   expect(result2).toEqual('FOR d IN col FILTER d.age == 42 RETURN d')

  //   const result3 = fetchByPropertyValue(
  //     'col',
  //     [
  //       { property: 'username', value: 'ABC' },
  //       { property: 'age', value: 42 }
  //     ],
  //     undefined,
  //     QueryType.STRING
  //   )
  //   expect(result3).toEqual('FOR d IN col FILTER d.username == "ABC" || d.age == 42 RETURN d')

  //   const result4 = fetchByCompositeValue(
  //     'col',
  //     [
  //       { property: 'username', value: 'ABC' },
  //       { property: 'age', value: 42 }
  //     ],
  //     undefined,
  //     QueryType.STRING
  //   )
  //   expect(result4).toEqual('FOR d IN col FILTER d.username == "ABC" && d.age == 42 RETURN d')
  // })

  // test('Unique constraint query', async () => {
  //   const result1 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [{ unique: { property: 'A', value: 'Annie Apple' } }]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result1).toEqual('FOR d IN col FILTER d.A == "Annie Apple" RETURN d._key')

  //   const result2 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [
  //         { unique: { property: 'A', value: 'Annie Apple' } },
  //         { unique: { property: 'B', value: 'Bouncy Ben' } }
  //       ]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result2).toEqual('FOR d IN col FILTER d.A == "Annie Apple" || d.B == "Bouncy Ben" RETURN d._key')

  //   const result3 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [
  //         {
  //           composite: [
  //             { property: 'C', value: 'Clever Cat' },
  //             { property: 'D', value: 'Dippy Duck' }
  //           ]
  //         }
  //       ]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result3).toEqual('FOR d IN col FILTER ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) RETURN d._key')

  //   const result4 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [
  //         {
  //           composite: [
  //             { property: 'C', value: 'Clever Cat' },
  //             { property: 'D', value: 'Dippy Duck' }
  //           ]
  //         },
  //         {
  //           composite: [
  //             { property: 'E', value: 'Eddy Elephant' },
  //             { property: 'F', value: 'Firefighter Fred' }
  //           ]
  //         }
  //       ]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result4).toEqual(
  //     'FOR d IN col FILTER ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) || ( d.E == "Eddy Elephant" && d.F == "Firefighter Fred" ) RETURN d._key'
  //   )

  //   const result6 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [
  //         { unique: { property: 'A', value: 'Annie Apple' } },
  //         {
  //           composite: [
  //             { property: 'C', value: 'Clever Cat' },
  //             { property: 'D', value: 'Dippy Duck' }
  //           ]
  //         }
  //       ]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result6).toEqual(
  //     'FOR d IN col FILTER d.A == "Annie Apple" || ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) RETURN d._key'
  //   )

  //   const result7 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [
  //         { unique: { property: 'A', value: 'Annie Apple' } },
  //         {
  //           composite: [
  //             { property: 'C', value: 'Clever Cat' },
  //             { property: 'D', value: 'Dippy Duck' }
  //           ]
  //         },
  //         { unique: { property: 'B', value: 'Bouncy Ben' } }
  //       ]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result7).toEqual(
  //     'FOR d IN col FILTER d.A == "Annie Apple" || ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) || d.B == "Bouncy Ben" RETURN d._key'
  //   )

  //   const result8 = uniqueConstraintQuery(
  //     {
  //       collection: 'col',
  //       constraints: [
  //         {
  //           composite: [
  //             { property: 'C', value: 'Clever Cat' },
  //             { property: 'D', value: 'Dippy Duck' }
  //           ]
  //         },
  //         { unique: { property: 'A', value: 'Annie Apple' } },
  //         {
  //           composite: [
  //             { property: 'E', value: 'Eddy Elephant' },
  //             { property: 'F', value: 'Firefighter Fred' }
  //           ]
  //         },
  //         { unique: { property: 'B', value: 'Bouncy Ben' } }
  //       ]
  //     },
  //     QueryType.STRING
  //   )

  //   expect(result8).toEqual(
  //     'FOR d IN col FILTER ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) || d.A == "Annie Apple" || ( d.E == "Eddy Elephant" && d.F == "Firefighter Fred" ) || d.B == "Bouncy Ben" RETURN d._key'
  //   )
  // })
})

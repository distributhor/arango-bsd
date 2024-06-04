// eslint-disable-next-line func-call-spacing
// const { aql } = require('arangojs/aql')
const { ArangoDB } = require('../../dist/index')

async function play() {
  try {
    const db = new ArangoDB({
      databaseName: 'guacamole-test1',
      url: 'http://root:letmein@localhost:8529'
    })

    // const result1 = await db.fetchByPropertiesAndCriteria(
    //   'cyclists',
    //   { properties: { property: 'strength', value: 'Climbing' } },
    //   { search: { properties: 'name', terms: 'mar' } },
    //   { printQuery: true }
    // )

    const result1 = await db.fetchByCriteria('cyclists', 'd.name == "Lance" || d.name == "Chris"', {
      printQuery: true, debugFilters: true
    })

    console.log(result1.data.length)

    // const cursor = await db.driver.query(aql`FOR d IN cyclists FILTER d.name == "Lance" RETURN d`)
    // const result2 = await cursor.all()
    // console.log(result2)

    // const result3 = await db.fetchOneByPropertyValue('cyclists', {
    //   property: 'name',
    //   value: 'Lance'
    // })

    // console.log(result3)

    // const result4 = await db.fetchOneByPropertyValue('cyclists', {
    //   property: 'name',
    //   value: 'lance'
    // })

    // console.log(result4)

    // const result5 = await db.fetchOneByPropertyValue('cyclists', {
    //   property: 'name',
    //   value: 'lance',
    //   options: {
    //     caseSensitive: true
    //   }
    // })

    // console.log(result5)

    // const result6 = await db.fetchByCriteria('cyclists', {
    //   filter: {
    //     filters: ['d.name == "Lance"', 'd.name == "Chris"'],
    //     match: MatchType.ANY
    //   }
    // })

    // console.log(result6)

    // const result7 = await db.fetchByCriteria(
    //   'cyclists',
    //   {
    //     search: {
    //       props: 'name', terms: ['lance', 'chris']
    //     }
    //   },
    //   {
    //     limit: 10
    //   }
    // )

    // console.log(result7)
  } catch (err) {
    console.log(err)
  }
}

play()

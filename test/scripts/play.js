// eslint-disable-next-line func-call-spacing
const { aql } = require('arangojs/aql')
const { ArangoDB, MatchType } = require('../../dist/index')

async function play() {
  try {
    const db = new ArangoDB({
      databaseName: 'guacamole-test1',
      url: 'http://root:letmein@localhost:8529'
    })

    const result = await db.fetchByCriteria('cyclists', {
      filter: {
        filters: ['d.name == "Lance"', 'd.name == "Chris"'],
        match: MatchType.ANY
      }
    })

    console.log(result)

    const cursor = await db.driver.query(aql`FOR d IN cyclists FILTER d.name == "Lance" RETURN d`)
    const result2 = await cursor.all()

    console.log(result2)
  } catch (err) {
    console.log(err)
  }
}

play()

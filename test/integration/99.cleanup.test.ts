/* eslint-disable jest/no-conditional-expect */
import { ArangoConnection } from '../../src/index'

import { VAR } from './jest.shared'

const conn = new ArangoConnection([{
  databaseName: VAR.dbName,
  url: process.env.GUACAMOLE_TEST_DB_URI,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}], { printQueries: false, debugFilters: false })

describe('Guacamole Integration Tests', () => {
  test('Delete database', async () => {
    expect.assertions(4)

    // await conn.system.dropDatabase(VAR.db1)
    // const testDB1Exists = await conn.db(VAR.db1).dbExists()
    // expect(testDB1Exists).toBeFalsy()

    await conn.system.dropDatabase(VAR.dbName2)
    const db2Exists = await conn.db(VAR.dbName2).dbExists()
    expect(db2Exists).toBeFalsy()

    try {
      await conn.system.dropDatabase(VAR.dbName2)
    } catch (e) {
      expect(e.response.body.code).toEqual(404)
      expect(e.response.body.errorNum).toEqual(1228)
      expect(e.response.body.errorMessage).toEqual('database not found')
    }
  })
})

import { ArangoConnection, EdgeDataScope, GraphFetchInstruction, GraphFetchStrategy } from '../../src/index'

import { VAR } from './jest.shared'

const conn = new ArangoConnection([{
  databaseName: VAR.dbName,
  url: VAR.dbUrl,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}], { printQueries: false, debugFilters: false })

function fetchAllTeamsForCyclist(id: string): GraphFetchInstruction {
  return ArangoConnection.util.toGraphFetchInstruction(
    id, VAR.cyclistCollection, VAR.teamMembershipGraph, 'OUTBOUND', GraphFetchStrategy.NON_DISTINCT_VERTEX
  )
}

function fetchAllCyclistsInTeam(id: string): GraphFetchInstruction {
  return ArangoConnection.util.toGraphFetchInstruction(
    id, VAR.teamCollection, VAR.teamMembershipGraph, 'INBOUND', GraphFetchStrategy.NON_DISTINCT_VERTEX
  )
}

function fetchAllCyclistsInRace(raceId: string): GraphFetchInstruction {
  return ArangoConnection.util.toGraphFetchInstruction(
    raceId, VAR.raceCollection, VAR.raceAttendanceGraph, 'OUTBOUND', GraphFetchStrategy.DISTINCT_VERTEX, 'race1', 'cyclist1', 'attendance1'
  )
}

function fetchAllRacesForCyclist(cyclistId: string): GraphFetchInstruction {
  return ArangoConnection.util.toGraphFetchInstruction(
    cyclistId, VAR.cyclistCollection, VAR.raceAttendanceGraph, 'INBOUND', GraphFetchStrategy.DISTINCT_VERTEX_EDGE_TUPLES, 'race2', 'cyclist2', 'attendance2'
  )
}

describe('Guacamole Integration Tests', () => {
  test('CRUD', async () => {
    // expect.assertions(199)

    const soler = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Soler' })
    const nibali = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Nibali' })
    const basso = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Basso' })

    const movistar = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: "Movistar - Caisse d'Epargne" })
    const bahrain = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Bahrain' })
    const astana = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Astana' })
    const uae = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'UAE Emirates' })
    const liquigas = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Liquigas' })
    const thinkoff = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Tinkoff - CSC' })

    const tourDeFrance = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Tour de France' })
    // const parisRoubaix = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Paris - Roubaix' })
    // const liegeBastogne = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Liège - Bastogne - Liège' })
    // const stradeBianche = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Strade Bianche' })
    // const milanoSanremo = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Milano - Sanremo' })
    // const gravelWorldChamps = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'UCI World Champs Gravel' })

    expect(soler._key).toBeDefined()
    expect(movistar._key).toBeDefined()
    expect(tourDeFrance._key).toBeDefined()

    // includeGroupData: false
    // FOR v, e, p IN 1 INBOUND "teams/416000141" GRAPH team_membership FILTER v != null RETURN v
    //
    // includeGroupData: true
    // FOR v, e, p IN 1 INBOUND "teams/416001064" GRAPH team_membership FILTER v != null RETURN MERGE(v, { "team_membership": e })
    const movistarTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(movistar._key)
    )

    expect(movistarTeam1.data.length).toEqual(2)
    expect(movistarTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marc', surname: 'Soler' }),
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    const bahrainTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(bahrain._key)
    )

    expect(bahrainTeam1.data.length).toEqual(2)
    expect(bahrainTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Matej', surname: 'Mohorič' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )

    const astanaTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(astana._key)
    )

    expect(astanaTeam1.data.length).toEqual(4)
    expect(astanaTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )

    const uaeTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(uae._key)
    )

    expect(uaeTeam1.data.length).toEqual(3)
    expect(uaeTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tim', surname: 'Wellens' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' }),
        expect.objectContaining({ name: 'Tadej', surname: 'Pogačar' })
      ])
    )

    const liquigasTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(liquigas._key)
    )

    expect(liquigasTeam1.data.length).toEqual(3)
    expect(liquigasTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' })
      ])
    )

    const thinkoffTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(thinkoff._key)
    )

    expect(thinkoffTeam1.data.length).toEqual(4)
    expect(thinkoffTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' })
      ])
    )

    const solerTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(soler._key)
    )

    expect(solerTeams.data.length).toEqual(2)
    expect(solerTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Movistar - Caisse d'Epargne" }),
        expect.objectContaining({ name: 'UAE Emirates' })
      ])
    )

    const nibaliTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(nibali._key)
    )

    expect(nibaliTeams.data.length).toEqual(4)
    expect(nibaliTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Astana' }),
        expect.objectContaining({ name: 'Bahrain' }),
        expect.objectContaining({ name: 'Liquigas' }),
        expect.objectContaining({ name: 'Trek' })
      ])
    )

    const bassoTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(basso._key)
    )

    expect(bassoTeams.data.length).toEqual(2)
    expect(bassoTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tinkoff - CSC' }),
        expect.objectContaining({ name: 'Liquigas' })
      ])
    )

    const tourDeFranceHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInRace(tourDeFrance._key), {
        strategy: GraphFetchStrategy.DISTINCT_VERTEX_EDGE_TUPLES,
        edgeDataScope: EdgeDataScope.MERGED
      }
    )

    console.log(JSON.stringify(tourDeFranceHistory))

    const nibaliHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(nibali._key), {
        strategy: GraphFetchStrategy.DISTINCT_VERTEX_EDGE_TUPLES,
        edgeDataScope: EdgeDataScope.MERGED
      }
    )

    console.log(JSON.stringify(nibaliHistory))

    // //////////////////////////////////////////////////////////////////////////////////
    //
    // Up to here we just validated that the original unmodified data is what we expect,
    // so that we can validate and compare subsequent actions against the original data.
    //
    // //////////////////////////////////////////////////////////////////////////////////

    // FOR d IN @@value0 FILTER d.@value1 == @value2
    // LET team_members_keys = (FOR v, e, p IN 1..1 ANY d GRAPH team_membership RETURN e._key)
    // LET team_members_removed = (FOR key IN team_members_keys REMOVE key IN team_members RETURN { _id: OLD._id, _key: OLD._key, _rev: OLD._rev })
    // REMOVE d IN cyclists RETURN MERGE({ _id: OLD._id, _key: OLD._key, _rev: OLD._rev }, { team_members: team_members_removed } )
    // bindVars: { '@value0': 'cyclists', value1: '_key', value2: '416049399' }
    const result1A = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, soler._key, [
      { graph: VAR.teamMembershipGraph, edge: VAR.teamMembershipEdge }
    ])

    expect(result1A.length).toEqual(1)
    expect(result1A).toBeDefined()
    expect(Array.isArray(result1A)).toBeTruthy()
    expect(result1A.length).toEqual(1)
    expect(result1A[0]._key).toBeDefined()
    // expect(result1A[0].team_members).toBeDefined()
    // expect(result1A[0].team_members.length).toEqual(2)

    const result1ValidationA = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(soler._key)
    )

    expect(result1ValidationA.data.length).toEqual(0)

    const movistarTeam2 = await await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(movistar._key)
    )

    expect(movistarTeam2.data.length).toEqual(1)
    expect(movistarTeam2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    const uaeTeam2 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(uae._key)
    )

    expect(uaeTeam2.data.length).toEqual(2)
    expect(uaeTeam2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tim', surname: 'Wellens' }),
        expect.objectContaining({ name: 'Tadej', surname: 'Pogačar' })
      ])
    )

    // FOR d IN @@value0 FILTER d.@value1 == @value2
    // LET team_members_keys = (FOR v, e, p IN 1..1 ANY d GRAPH team_membership RETURN e._key)
    // LET team_members_removed = (FOR key IN team_members_keys REMOVE key IN team_members RETURN { _id: OLD._id, _key: OLD._key, _rev: OLD._rev })
    // REMOVE d IN cyclists RETURN MERGE({ _id: OLD._id, _key: OLD._key, _rev: OLD._rev }, { team_members: team_members_removed } )
    // bindVars: { '@value0': 'cyclists', value1: 'surname', value2: 'Basso' }
    const result3C = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, { value: 'Basso', property: 'surname' }, [
      { graph: VAR.teamMembershipGraph, edge: VAR.teamMembershipEdge }
    ])

    // console.log(result3C)
    expect(result3C.length).toEqual(1)
    expect(result3C).toBeDefined()
    expect(Array.isArray(result3C)).toBeTruthy()
    expect(result3C.length).toEqual(1)
    expect(result3C[0]._key).toBeDefined()
    // expect(result3C[0].team_members).toBeDefined()
    // expect(result3C[0].team_members.length).toEqual(2)

    const liquigasTeam2 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(liquigas._key)
    )

    expect(liquigasTeam2.data.length).toEqual(2)
    expect(liquigasTeam2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' })
      ])
    )

    const thinkoffTeam2 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(thinkoff._key)
    )

    expect(thinkoffTeam2.data.length).toEqual(3)
    expect(thinkoffTeam2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
      ])
    )
  })
})

import { ArangoConnection, GraphFetchInstruction, GraphFetchStrategy } from '../../src/index'

import { VAR } from './jest.shared'

const conn = new ArangoConnection([{
  databaseName: VAR.dbName,
  url: VAR.dbUrl,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}], { printQueries: false, debugFilters: false })

function fetchAllTeamsForCyclist(cyclistId: string): GraphFetchInstruction {
  return {
    from: { key: cyclistId, collection: VAR.cyclistCollection },
    graph: VAR.teamMembershipGraph,
    direction: 'OUTBOUND',
    strategy: GraphFetchStrategy.NON_DISTINCT_VERTEX,
    edgeTrim: { keep: ['_key', '_from', '_to', 'year', 'position', 'result'] }
  }
}

function fetchAllCyclistsInTeam(teamId: string): GraphFetchInstruction {
  return {
    from: { key: teamId, collection: VAR.teamCollection },
    graph: VAR.teamMembershipGraph,
    direction: 'INBOUND',
    strategy: GraphFetchStrategy.NON_DISTINCT_VERTEX,
    vertexTrim: { keep: ['name', 'surname'] },
    edgeTrim: { keep: ['_key', '_from', '_to', 'year', 'position', 'result'] }
  }
}

function fetchAllCyclistsInRace(raceId: string): GraphFetchInstruction {
  return {
    from: { key: raceId, collection: VAR.raceCollection },
    graph: VAR.raceAttendanceGraph,
    direction: 'OUTBOUND',
    strategy: GraphFetchStrategy.DISTINCT_VERTEX_EDGES_JOINED,
    vertexNameFrom: 'cyclist',
    vertexNameTo: 'race',
    edgeName: 'attendance',
    vertexTrim: { keep: ['name', 'surname'] },
    edgeTrim: { keep: ['_key', '_from', '_to', 'year', 'position', 'result'] }
  }
}

function fetchAllRacesForCyclist(cyclistId: string): GraphFetchInstruction {
  return {
    from: { key: cyclistId, collection: VAR.cyclistCollection },
    graph: VAR.raceAttendanceGraph,
    direction: 'INBOUND',
    strategy: GraphFetchStrategy.DISTINCT_VERTEX_EDGES_JOINED,
    vertexNameFrom: 'cyclist',
    vertexNameTo: 'race',
    edgeName: 'attendance',
    vertexTrim: { keep: ['name', 'type'] },
    edgeTrim: { keep: ['_key', '_from', '_to', 'year', 'position', 'result'] }
  }
}

describe('Guacamole Integration Tests', () => {
  test('CRUD', async () => {
    // expect.assertions(199)

    const soler = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Soler' })
    const cancellara = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Cancellara' })
    const nibali = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Nibali' })
    const basso = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Basso' })
    const hincapie = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Hincapie' })
    const mohoric = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Mohorič' })
    const pinot = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'Pinot' })
    const gva = await conn.db(VAR.dbName).read(VAR.cyclistCollection, { property: 'surname', value: 'van Avermaet' })

    const movistar = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: "Movistar - Caisse d'Epargne" })
    const bahrain = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Bahrain' })
    const astana = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Astana' })
    const uae = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'UAE Emirates' })
    const liquigas = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Liquigas' })
    const tinkoff = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'Tinkoff - CSC' })
    const bmc = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'BMC' })
    const fdj = await conn.db(VAR.dbName).read(VAR.teamCollection, { property: 'name', value: 'FDJ' })

    const tourDeFrance = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Tour de France' })
    const parisRoubaix = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Paris - Roubaix' })
    const liegeBastogne = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Liège - Bastogne - Liège' })
    const milanoSanremo = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Milano - Sanremo' })
    const tirreno = await conn.db(VAR.dbName).read(VAR.raceCollection, { property: 'name', value: 'Tirreno - Adriatico' })

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

    const tinkoffTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(tinkoff._key)
    )

    expect(tinkoffTeam1.data.length).toEqual(4)
    expect(tinkoffTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' })
      ])
    )

    const bmcTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(bmc._key)
    )

    expect(bmcTeam1.data.length).toEqual(3)
    expect(bmcTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Rohan', surname: 'Dennis' }),
        expect.objectContaining({ name: 'Greg', surname: 'van Avermaet' }),
        expect.objectContaining({ name: 'George', surname: 'Hincapie' })
      ])
    )

    const fdjTeam1 = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInTeam(fdj._key)
    )

    expect(fdjTeam1.data.length).toEqual(2)
    expect(fdjTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Arnaud', surname: 'Démare' }),
        expect.objectContaining({ name: 'Thibaut', surname: 'Pinot' })
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

    const hincapieTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(hincapie._key)
    )

    expect(hincapieTeams.data.length).toEqual(3)
    expect(hincapieTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'HTC Columbia - T-Mobile' }),
        expect.objectContaining({ name: 'Discovery - US Postal' }),
        expect.objectContaining({ name: 'BMC' })
      ])
    )

    const mohoricTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(mohoric._key)
    )

    expect(mohoricTeams.data.length).toEqual(1)
    expect(mohoricTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Bahrain' })
      ])
    )

    const pinotTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(pinot._key)
    )

    expect(pinotTeams.data.length).toEqual(1)
    expect(pinotTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'FDJ' })
      ])
    )

    const gvaTeams = await conn.db(VAR.dbName).fetchRelations(
      fetchAllTeamsForCyclist(gva._key)
    )

    expect(gvaTeams.data.length).toEqual(3)
    expect(gvaTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'AG2R' }),
        expect.objectContaining({ name: 'Lotto' }),
        expect.objectContaining({ name: 'BMC' })
      ])
    )

    const parisRoubaixHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInRace(parisRoubaix._key)
    )

    expect(parisRoubaixHistory.data.length).toEqual(7)
    expect(parisRoubaixHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'George', surname: 'Hincapie' }),
        expect.objectContaining({ name: 'Mathieu', surname: 'van der Poel' }),
        expect.objectContaining({ name: 'Greg', surname: 'van Avermaet' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Matej', surname: 'Mohorič' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
      ])
    )

    expect(parisRoubaixHistory.data[0].name).toBeDefined()
    expect(parisRoubaixHistory.data[0].surname).toBeDefined()
    expect(parisRoubaixHistory.data[0].country).toBeUndefined()
    expect(parisRoubaixHistory.data[0].discipline).toBeUndefined()
    expect(parisRoubaixHistory.data[0].attendance[0]._key).toBeDefined()
    expect(parisRoubaixHistory.data[0].attendance[0].position).toBeDefined()
    expect(parisRoubaixHistory.data[0].attendance[0].result).toBeDefined()
    expect(parisRoubaixHistory.data[0].attendance[0].year).toBeDefined()
    expect(parisRoubaixHistory.data[0].attendance[0]._rev).toBeUndefined()

    const tdfHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInRace(tourDeFrance._key)
    )

    expect(tdfHistory.data.length).toEqual(14)
    expect(tdfHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'George', surname: 'Hincapie' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Thibaut', surname: 'Pinot' }),
        expect.objectContaining({ name: 'Chris', surname: 'Froome' })
      ])
    )

    const liegeBastogneHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInRace(liegeBastogne._key)
    )
    expect(liegeBastogneHistory.data.length).toEqual(4)
    expect(liegeBastogneHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )

    const milanoSanremoHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInRace(milanoSanremo._key)
    )

    expect(milanoSanremoHistory.data.length).toEqual(5)
    expect(milanoSanremoHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Matej', surname: 'Mohorič' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
      ])
    )

    const tirrenoHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllCyclistsInRace(tirreno._key)
    )

    expect(tirrenoHistory.data.length).toEqual(8)
    expect(tirrenoHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'George', surname: 'Hincapie' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Wout', surname: 'van Aert' }),
        expect.objectContaining({ name: 'Tadej', surname: 'Pogačar' }),
        expect.objectContaining({ name: 'Greg', surname: 'van Avermaet' }),
        expect.objectContaining({ name: 'Thibaut', surname: 'Pinot' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
      ])
    )

    const solerHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(soler._key)
    )

    expect(solerHistory.data.length).toEqual(0)

    const cancellaraHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(cancellara._key)
    )

    expect(cancellaraHistory.data.length).toEqual(6)
    expect(cancellaraHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Olympic Games ITT' }),
        expect.objectContaining({ name: 'UCI World Champs ITT' }),
        expect.objectContaining({ name: 'Milano - Sanremo' }),
        expect.objectContaining({ name: 'Tour de Suisse' }),
        expect.objectContaining({ name: 'Tirreno - Adriatico' }),
        expect.objectContaining({ name: 'Paris - Roubaix' })
      ])
    )

    expect(cancellaraHistory.data[0].name).toBeDefined()
    expect(cancellaraHistory.data[0].type).toBeDefined()
    expect(cancellaraHistory.data[0].discipline).toBeUndefined()
    expect(cancellaraHistory.data[0].attendance[0]._key).toBeDefined()
    expect(cancellaraHistory.data[0].attendance[0].position).toBeDefined()
    expect(cancellaraHistory.data[0].attendance[0].result).toBeDefined()
    expect(cancellaraHistory.data[0].attendance[0].year).toBeDefined()
    expect(cancellaraHistory.data[0].attendance[0]._rev).toBeUndefined()

    const nibaliHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(nibali._key)
    )

    expect(nibaliHistory.data.length).toEqual(5)
    expect(nibaliHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Critérium du Dauphiné' }),
        expect.objectContaining({ name: 'Liège - Bastogne - Liège' }),
        expect.objectContaining({ name: 'La Vuelta a España' }),
        expect.objectContaining({ name: "Giro d'Italia" }),
        expect.objectContaining({ name: 'Tour de France' })
      ])
    )

    const bassoHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(basso._key)
    )

    expect(bassoHistory.data.length).toEqual(6)
    expect(bassoHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Volta Ciclista a Catalunya' }),
        expect.objectContaining({ name: 'Tirreno - Adriatico' }),
        expect.objectContaining({ name: 'Tour of Britain' }),
        expect.objectContaining({ name: "Giro d'Italia" }),
        expect.objectContaining({ name: 'Tour de France' }),
        expect.objectContaining({ name: 'Paris - Nice' })
      ])
    )

    const hincapieHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(hincapie._key)
    )

    expect(hincapieHistory.data.length).toEqual(5)
    expect(hincapieHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Gent - Wevelgem' }),
        expect.objectContaining({ name: 'Tirreno - Adriatico' }),
        expect.objectContaining({ name: 'Tour of Benelux' }),
        expect.objectContaining({ name: 'Tour de France' }),
        expect.objectContaining({ name: 'Paris - Roubaix' })
      ])
    )

    const mohoricHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(mohoric._key)
    )

    expect(mohoricHistory.data.length).toEqual(4)
    expect(mohoricHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Milano - Sanremo' }),
        expect.objectContaining({ name: 'UCI World Champs Gravel' }),
        expect.objectContaining({ name: 'Strade Bianche' }),
        expect.objectContaining({ name: 'Paris - Roubaix' })
      ])
    )

    const pinotHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(pinot._key)
    )

    expect(pinotHistory.data.length).toEqual(4)
    expect(pinotHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tour de France' }),
        expect.objectContaining({ name: 'Tirreno - Adriatico' }),
        expect.objectContaining({ name: "Giro d'Italia" }),
        expect.objectContaining({ name: 'Tour de Suisse' })
      ])
    )

    const gvaHistory = await conn.db(VAR.dbName).fetchRelations(
      fetchAllRacesForCyclist(gva._key)
    )

    expect(gvaHistory.data.length).toEqual(4)
    expect(gvaHistory.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Paris - Roubaix' }),
        expect.objectContaining({ name: 'Tirreno - Adriatico' }),
        expect.objectContaining({ name: 'Olympic Games Road Race' }),
        expect.objectContaining({ name: 'The Traka 200' })
      ])
    )

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
    //   const result1A = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, soler._key, [
    //     { graph: VAR.teamMembershipGraph, edge: VAR.teamMembershipEdge }
    //   ])

    //   expect(result1A.length).toEqual(1)
    //   expect(result1A).toBeDefined()
    //   expect(Array.isArray(result1A)).toBeTruthy()
    //   expect(result1A.length).toEqual(1)
    //   expect(result1A[0]._key).toBeDefined()
    //   // expect(result1A[0].team_members).toBeDefined()
    //   // expect(result1A[0].team_members.length).toEqual(2)

    //   const result1ValidationA = await conn.db(VAR.dbName).fetchRelations(
    //     fetchAllTeamsForCyclist(soler._key)
    //   )

    //   expect(result1ValidationA.data.length).toEqual(0)

    //   const movistarTeam2 = await await conn.db(VAR.dbName).fetchRelations(
    //     fetchAllCyclistsInTeam(movistar._key)
    //   )

    //   expect(movistarTeam2.data.length).toEqual(1)
    //   expect(movistarTeam2.data).toEqual(
    //     expect.arrayContaining([
    //       expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
    //     ])
    //   )

    //   const uaeTeam2 = await conn.db(VAR.dbName).fetchRelations(
    //     fetchAllCyclistsInTeam(uae._key)
    //   )

    //   expect(uaeTeam2.data.length).toEqual(2)
    //   expect(uaeTeam2.data).toEqual(
    //     expect.arrayContaining([
    //       expect.objectContaining({ name: 'Tim', surname: 'Wellens' }),
    //       expect.objectContaining({ name: 'Tadej', surname: 'Pogačar' })
    //     ])
    //   )

    //   // FOR d IN @@value0 FILTER d.@value1 == @value2
    //   // LET team_members_keys = (FOR v, e, p IN 1..1 ANY d GRAPH team_membership RETURN e._key)
    //   // LET team_members_removed = (FOR key IN team_members_keys REMOVE key IN team_members RETURN { _id: OLD._id, _key: OLD._key, _rev: OLD._rev })
    //   // REMOVE d IN cyclists RETURN MERGE({ _id: OLD._id, _key: OLD._key, _rev: OLD._rev }, { team_members: team_members_removed } )
    //   // bindVars: { '@value0': 'cyclists', value1: 'surname', value2: 'Basso' }
    //   const result3C = await conn.db(VAR.dbName).delete(VAR.cyclistCollection, { value: 'Basso', property: 'surname' }, [
    //     { graph: VAR.teamMembershipGraph, edge: VAR.teamMembershipEdge }
    //   ])

    //   // console.log(result3C)
    //   expect(result3C.length).toEqual(1)
    //   expect(result3C).toBeDefined()
    //   expect(Array.isArray(result3C)).toBeTruthy()
    //   expect(result3C.length).toEqual(1)
    //   expect(result3C[0]._key).toBeDefined()
    //   // expect(result3C[0].team_members).toBeDefined()
    //   // expect(result3C[0].team_members.length).toEqual(2)

    //   const liquigasTeam2 = await conn.db(VAR.dbName).fetchRelations(
    //     fetchAllCyclistsInTeam(liquigas._key)
    //   )

    //   expect(liquigasTeam2.data.length).toEqual(2)
    //   expect(liquigasTeam2.data).toEqual(
    //     expect.arrayContaining([
    //       expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
    //       expect.objectContaining({ name: 'Peter', surname: 'Sagan' })
    //     ])
    //   )

    //   const tinkoffTeam2 = await conn.db(VAR.dbName).fetchRelations(
    //     fetchAllCyclistsInTeam(tinkoff._key)
    //   )

  //   expect(tinkoffTeam2.data.length).toEqual(3)
  //   expect(tinkoffTeam2.data).toEqual(
  //     expect.arrayContaining([
  //       expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
  //       expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
  //       expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' })
  //     ])
  //   )
  })
})

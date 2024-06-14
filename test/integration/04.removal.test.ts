/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable jest/no-conditional-expect */
import { ArangoConnection } from '../../src/index'

import { VAR } from './jest.shared'

const conn = new ArangoConnection([{
  databaseName: VAR.dbName,
  url: VAR.dbUrl,
  auth: { username: VAR.dbAdminUser, password: VAR.dbAdminPassword }
}], { printQueries: false, debugFilters: false })

function fetchAllUsersInGroup(groupId: string, options?: any): string {
  // if (options?.fetchTheGroupItselfAndIncludeMembersip) {
  //   let query = 'LET group = DOCUMENT("' + VAR.groupCollection + '/' + groupId + '") '
  //   query += 'LET ve = ('
  //   query += 'FOR v, e IN 1 INBOUND "' + VAR.groupCollection + '/' + groupId + '" GRAPH ' + VAR.groupMembershipGraph + ' FILTER v != null RETURN MERGE(v, { "' + VAR.groupMembershipGraph + '": e })'
  //   query += ') RETURN MERGE(group, { "' + VAR.userCollection + '": ve })'
  //   return query
  // }

  let query = 'FOR v, e, p IN 1 INBOUND "' + VAR.groupCollection + '/' + groupId + '" GRAPH ' + VAR.groupMembershipGraph + ' FILTER v != null'

  // if (options.hasOwnProperty('filter') && options.filter) {
  //   query += ' FILTER v.' + options.filter
  // }

  if (options?.includeGroupData) {
    if (typeof options.includeGroupData === 'string') {
      query += ' RETURN MERGE(v, { "' + options.includeGroupData + '": e })'
    } else {
      query += ' RETURN MERGE(v, { "' + VAR.groupMembershipGraph + '": e })'
    }
  } else {
    query += ' RETURN v'
  }

  return query
}

function fetchAllGroupsForUser(userId: string, options?: any): string {
  // if (options?.fetchTheGroupItselfAndIncludeMembersip) {
  //   let query = 'LET group = DOCUMENT("' + VAR.groupCollection + '/' + groupId + '") '
  //   query += 'LET ve = ('
  //   query += 'FOR v, e IN 1 INBOUND "' + VAR.groupCollection + '/' + groupId + '" GRAPH ' + VAR.groupMembershipGraph + ' FILTER v != null RETURN MERGE(v, { "' + VAR.groupMembershipGraph + '": e })'
  //   query += ') RETURN MERGE(group, { "' + VAR.userCollection + '": ve })'
  //   return query
  // }

  let query = 'FOR v, e, p IN 1 OUTBOUND "' + VAR.userCollection + '/' + userId + '" GRAPH ' + VAR.groupMembershipGraph + ' FILTER v != null'

  // if (options.hasOwnProperty('filter') && options.filter) {
  //   query += ' FILTER v.' + options.filter
  // }

  if (options?.includeGroupData) {
    if (typeof options.includeGroupData === 'string') {
      query += ' RETURN MERGE(v, { "' + options.includeGroupData + '": e })'
    } else {
      query += ' RETURN MERGE(v, { "' + VAR.groupMembershipGraph + '": e })'
    }
  } else {
    query += ' RETURN v'
  }

  return query
}

describe('Guacamole Integration Tests', () => {
  test('CRUD', async () => {
    // expect.assertions(199)

    const soler = await conn.db(VAR.dbName).read(VAR.userCollection, { property: 'surname', value: 'Soler' })
    const nibali = await conn.db(VAR.dbName).read(VAR.userCollection, { property: 'surname', value: 'Nibali' })
    const basso = await conn.db(VAR.dbName).read(VAR.userCollection, { property: 'surname', value: 'Basso' })

    const movistar = await conn.db(VAR.dbName).read(VAR.groupCollection, { property: 'name', value: "Movistar - Caisse d'Epargne" })
    const bahrain = await conn.db(VAR.dbName).read(VAR.groupCollection, { property: 'name', value: 'Bahrain' })
    const astana = await conn.db(VAR.dbName).read(VAR.groupCollection, { property: 'name', value: 'Astana' })
    const uae = await conn.db(VAR.dbName).read(VAR.groupCollection, { property: 'name', value: 'UAE Emirates' })
    const liquigas = await conn.db(VAR.dbName).read(VAR.groupCollection, { property: 'name', value: 'Liquigas' })
    const thinkoff = await conn.db(VAR.dbName).read(VAR.groupCollection, { property: 'name', value: 'Tinkoff - CSC' })

    expect(soler._key).toBeDefined()
    expect(nibali._key).toBeDefined()
    expect(basso._key).toBeDefined()

    expect(movistar._key).toBeDefined()
    expect(bahrain._key).toBeDefined()
    expect(astana._key).toBeDefined()
    expect(uae._key).toBeDefined()
    expect(liquigas._key).toBeDefined()
    expect(thinkoff._key).toBeDefined()

    // includeGroupData: false
    // FOR v, e, p IN 1 INBOUND "teams/416000141" GRAPH team_membership FILTER v != null RETURN v
    //
    // includeGroupData: true
    // FOR v, e, p IN 1 INBOUND "teams/416001064" GRAPH team_membership FILTER v != null RETURN MERGE(v, { "team_membership": e })
    const movistarTeam1 = await conn.db(VAR.dbName).return(
      fetchAllUsersInGroup(movistar._key, { includeGroupData: true })
    )

    expect(movistarTeam1.data.length).toEqual(2)
    expect(movistarTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Marc', surname: 'Soler' }),
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    const bahrainTeam1 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(bahrain._key))

    expect(bahrainTeam1.data.length).toEqual(2)
    expect(bahrainTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Matej', surname: 'Mohorič' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )

    const astanaTeam1 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(astana._key))

    expect(astanaTeam1.data.length).toEqual(4)
    expect(astanaTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Lance', surname: 'Armstrong' }),
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Mark', surname: 'Cavendish' }),
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' })
      ])
    )

    const uaeTeam1 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(uae._key))

    expect(uaeTeam1.data.length).toEqual(3)
    expect(uaeTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tim', surname: 'Wellens' }),
        expect.objectContaining({ name: 'Marc', surname: 'Soler' }),
        expect.objectContaining({ name: 'Tadej', surname: 'Pogačar' })
      ])
    )

    const liquigasTeam1 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(liquigas._key))

    expect(liquigasTeam1.data.length).toEqual(3)
    expect(liquigasTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' })
      ])
    )

    const thinkoffTeam1 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(thinkoff._key))

    expect(thinkoffTeam1.data.length).toEqual(4)
    expect(thinkoffTeam1.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alberto', surname: 'Contador' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' }),
        expect.objectContaining({ name: 'Fabian', surname: 'Cancellara' }),
        expect.objectContaining({ name: 'Ivan', surname: 'Basso' })
      ])
    )

    const solerTeams = await conn.db(VAR.dbName).return(fetchAllGroupsForUser(soler._key))

    expect(solerTeams.data.length).toEqual(2)
    expect(solerTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Movistar - Caisse d'Epargne" }),
        expect.objectContaining({ name: 'UAE Emirates' })
      ])
    )

    const nibaliTeams = await conn.db(VAR.dbName).return(fetchAllGroupsForUser(nibali._key))

    expect(nibaliTeams.data.length).toEqual(4)
    expect(nibaliTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Astana' }),
        expect.objectContaining({ name: 'Bahrain' }),
        expect.objectContaining({ name: 'Liquigas' }),
        expect.objectContaining({ name: 'Trek' })
      ])
    )

    const bassoTeams = await conn.db(VAR.dbName).return(fetchAllGroupsForUser(basso._key))

    expect(bassoTeams.data.length).toEqual(2)
    expect(bassoTeams.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Tinkoff - CSC' }),
        expect.objectContaining({ name: 'Liquigas' })
      ])
    )

    // FOR d IN @@value0 FILTER d.@value1 == @value2
    // LET team_members_keys = (FOR v, e, p IN 1..1 ANY d GRAPH team_membership RETURN e._key)
    // LET team_members_removed = (FOR key IN team_members_keys REMOVE key IN team_members RETURN { _id: OLD._id, _key: OLD._key, _rev: OLD._rev })
    // REMOVE d IN cyclists RETURN MERGE({ _id: OLD._id, _key: OLD._key, _rev: OLD._rev }, { team_members: team_members_removed } )
    // bindVars: { '@value0': 'cyclists', value1: '_key', value2: '416049399' }
    const result1A = await conn.db(VAR.dbName).delete(VAR.userCollection, soler._key, [
      { graph: VAR.groupMembershipGraph, edge: VAR.userToGroupEdge }
    ])

    // console.log(result1A[0])
    // [
    //   {
    //     _id: 'cyclists/416043956',
    //     _key: '416043956',
    //     _rev: '_i_YPJHC--O',
    //     team_members: [
    //       {
    //         _id: 'team_members/416044057',
    //         _key: '416044057',
    //         _rev: '_i_YPJIG--_'
    //       },
    //       {
    //         _id: 'team_members/416044033',
    //         _key: '416044033',
    //         _rev: '_i_YPJH2--_'
    //       }
    //     ]
    //   }
    // ]
    expect(result1A.length).toEqual(1)
    expect(result1A).toBeDefined()
    expect(Array.isArray(result1A)).toBeTruthy()
    expect(result1A.length).toEqual(1)
    expect(result1A[0]._key).toBeDefined()
    // expect(result1A[0].team_members).toBeDefined()
    // expect(result1A[0].team_members.length).toEqual(2)

    const result1ValidationA = await conn.db(VAR.dbName).return(fetchAllGroupsForUser(soler._key))

    expect(result1ValidationA.data.length).toEqual(0)

    const movistarTeam2 = await await conn.db(VAR.dbName).return(fetchAllUsersInGroup(movistar._key))

    expect(movistarTeam2.data.length).toEqual(1)
    expect(movistarTeam2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Alejandro', surname: 'Valverde' })
      ])
    )

    const uaeTeam2 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(uae._key))

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
    const result3C = await conn.db(VAR.dbName).delete(VAR.userCollection, { value: 'Basso', property: 'surname' }, [
      { graph: VAR.groupMembershipGraph, edge: VAR.userToGroupEdge }
    ])

    // console.log(result3C)
    expect(result3C.length).toEqual(1)
    expect(result3C).toBeDefined()
    expect(Array.isArray(result3C)).toBeTruthy()
    expect(result3C.length).toEqual(1)
    expect(result3C[0]._key).toBeDefined()
    // expect(result3C[0].team_members).toBeDefined()
    // expect(result3C[0].team_members.length).toEqual(2)

    const liquigasTeam2 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(liquigas._key))

    expect(liquigasTeam2.data.length).toEqual(2)
    expect(liquigasTeam2.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Vincenzo', surname: 'Nibali' }),
        expect.objectContaining({ name: 'Peter', surname: 'Sagan' })
      ])
    )

    const thinkoffTeam2 = await conn.db(VAR.dbName).return(fetchAllUsersInGroup(thinkoff._key))

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

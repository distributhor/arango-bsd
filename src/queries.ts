/* eslint-disable no-prototype-builtins */
import { aql, AqlQuery } from 'arangojs/aql'
import { DocumentCollection } from 'arangojs/collection'
import {
  UniqueConstraint,
  isCompositeKey,
  isUniqueValue,
  PropertyValue,
  SearchTerms,
  Filter,
  Criteria,
  MatchTypeOperator,
  MatchType,
  FetchOptions,
  GuacamoleOptions,
  isSearch,
  isFilter
} from './index'

export class Queries {
  private readonly go: GuacamoleOptions

  constructor(options: GuacamoleOptions = {}) {
    this.go = options
  }

  /** @internal */
  private _debugFunctions(): boolean {
    return !!(this.go?.debugFunctions)
  }

  private _printQuery(options?: FetchOptions): boolean {
    if (options?.printQuery) {
      return true
    }

    return !!(this.go?.printQueries)
  }

  /** @internal */
  private _toSearchFilter(search: SearchTerms): Filter {
    const filters: string[] = []

    const props = typeof search.props === 'string'
      ? search.props.split(',').map(p => `d.${p}`)
      : search.props.map(p => `d.${p}`)

    const terms = typeof search.terms === 'string'
      ? search.terms.split(',')
      : search.terms

    for (let i = 0; i < props.length; i++) {
      for (let j = 0; j < terms.length; j++) {
        if (terms[j].trim().toLowerCase() === 'null') {
          filters.push(props[i].trim() + ' == null')
        } else if (terms[j].trim().toLowerCase() === '!null') {
          filters.push(props[i].trim() + ' != null')
        } else {
          filters.push('LIKE(' + props[i].trim() + ', "%' + terms[j].trim() + '%", true)')
        }
      }
    }

    return {
      match: search.match ? search.match : MatchType.ANY,
      filters
    }
  }

  /** @internal */
  private _toFilterString(filter: string | Filter | SearchTerms): string {
    if (typeof filter === 'string') {
      return filter
    }

    if (isSearch(filter)) {
      return this._toFilterString(this._toSearchFilter(filter))
    }

    if (!isFilter(filter)) {
      throw new Error('Invalid input received for filter string conversion')
    }

    let filterString = ''

    const matchType: MatchType = filter.match ? filter.match : MatchType.ANY
    for (let i = 0; i < filter.filters.length; i++) {
      if (i > 0) {
        filterString += ` ${MatchTypeOperator[matchType]} `
      }
      filterString += filter.filters[i]
    }

    return filterString
  }

  /** @internal */
  private _fetchByKeyValue(
    collection: string,
    identifier: PropertyValue | PropertyValue[],
    keyValueMatchType: MatchType,
    criteria?: Criteria,
    options: FetchOptions = {}
  ): AqlQuery {
    if (this._printQuery(options) || this._debugFunctions()) {
      console.log(`_fetchByKeyValue: ${collection}`)
      console.log(identifier)
      if (criteria) {
        console.dir(criteria)
      }
    }

    const params: any = {}

    let query = `FOR d IN ${collection} FILTER (`

    if (criteria && (criteria.filter ?? criteria.search)) {
      query += ' ('
    }

    if (Array.isArray(identifier)) {
      let keyCount = 0

      for (const kv of identifier) {
        keyCount++

        if (keyCount > 1) {
          query += ` ${MatchTypeOperator[keyValueMatchType]}`
        }

        const keyParam = `p${keyCount}`
        const valueParam = `v${keyCount}`

        if (kv.property.indexOf('.') > 0) {
          params[keyParam] = kv.property.split('.')
        } else {
          params[keyParam] = kv.property
        }

        if (kv.options?.ignoreCase) {
          params[valueParam] = kv.value.toLowerCase()
          query += ` LOWER(d.@${keyParam}) == @${valueParam}`
        } else {
          params[valueParam] = kv.value
          query += ` d.@${keyParam} == @${valueParam}`
        }
      }
    } else {
      if (identifier.property.indexOf('.') > 0) {
        params.p = identifier.property.split('.')
      } else {
        params.p = identifier.property
      }

      if (identifier.options?.ignoreCase) {
        params.v = identifier.value.toLowerCase()
        query += ' LOWER(d.@p) == @v'
      } else {
        params.v = identifier.value
        query += ' d.@p == @v'
      }
    }

    if (criteria?.filter && criteria.search) {
      query += ' ) AND ( ( '
    } else if (criteria && (criteria.filter ?? criteria.search)) {
      query += ' ) AND ( '
    }

    if (criteria) {
      if (criteria.filter) {
        query += this._toFilterString(criteria.filter)
      }

      if (criteria.filter && criteria.search) {
        query += ` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `
        // query += ` ) ${criteria.match ? criteria.match : MatchType.ANY} ( `
      }

      if (criteria.search) {
        query += this._toFilterString(criteria.search)
      }
    }

    if (criteria?.filter && criteria.search) {
      query += ' ) )'
    } else if (criteria && (criteria.filter ?? criteria.search)) {
      query += ' )'
    }

    query += ' )'

    if (options.hasOwnProperty('sortBy')) {
      query += ` SORT d.${options.sortBy}`

      if (options.hasOwnProperty('sortOrder')) {
        if (options.sortOrder === 'ascending') {
          query += ' ASC'
        } else if (options.sortOrder === 'descending') {
          query += ' DESC'
        }
      }
    }

    if (options.limit && options.limit > 0) {
      if (options.offset) {
        query += ` LIMIT ${options.offset}, ${options.limit}`
      } else {
        query += ` LIMIT ${options.limit}`
      }
    }

    query += ' RETURN d'

    if (this._printQuery(options)) {
      console.log(query)
      console.log(params)
      console.log('')
    }

    return {
      query,
      bindVars: params
    }
  }

  public fetchByMatchingProperty(
    collection: string,
    identifier: PropertyValue,
    options: FetchOptions = {},
    criteria?: Criteria
  ): AqlQuery {
    if (this._debugFunctions()) {
      console.log(`fetchByMatchingProperty: ${collection}`)
    }

    return this._fetchByKeyValue(collection, identifier, MatchType.ANY, criteria, options)
  }

  public fetchByMatchingAnyProperty(
    collection: string,
    identifier: PropertyValue[],
    options: FetchOptions = {},
    criteria?: Criteria
  ): AqlQuery {
    if (this._debugFunctions()) {
      console.log(`fetchByMatchingAnyProperty: ${collection}`)
    }

    return this._fetchByKeyValue(collection, identifier, MatchType.ANY, criteria, options)
  }

  public fetchByMatchingAllProperties(
    collection: string,
    identifier: PropertyValue[],
    options: FetchOptions = {},
    criteria?: Criteria
  ): AqlQuery {
    if (this._debugFunctions()) {
      console.log(`fetchByMatchingAllProperties: ${collection}`)
    }

    return this._fetchByKeyValue(collection, identifier, MatchType.ALL, criteria, options)
  }

  public fetchByCriteria(
    collection: string,
    criteria: Criteria,
    options: FetchOptions = {}
  ): AqlQuery {
    if (this._printQuery(options) || this._debugFunctions()) {
      console.log(`fetchByCriteria: ${collection}`)
      if (criteria) {
        console.dir(criteria)
      }
    }

    const params: any = {}

    let query = `FOR d IN ${collection} FILTER ( `

    if (criteria.filter && criteria.search) {
      query += '( '
    }

    if (criteria.filter) {
      query += this._toFilterString(criteria.filter)
    }

    if (criteria.filter && criteria.search) {
      query += ` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `
      // query += ` ) ${criteria.match ? criteria.match : MatchType.ANY} ( `
    }

    if (criteria.search) {
      query += this._toFilterString(criteria.search)
    }

    if (criteria.filter && criteria.search) {
      query += ' )'
    }

    query += ' )'

    if (options?.hasOwnProperty('sortBy')) {
      query += ` SORT d.${options.sortBy}`

      if (options.hasOwnProperty('sortOrder')) {
        if (options.sortOrder === 'ascending') {
          query += ' ASC'
        } else if (options.sortOrder === 'descending') {
          query += ' DESC'
        }
      }
    }

    if (options.limit && options.limit > 0) {
      if (options.offset) {
        query += ` LIMIT ${options.offset}, ${options.limit}`
      } else {
        query += ` LIMIT ${options.limit}`
      }
    }

    // if (this._hasOmitOption(options)) {
    //   query += " RETURN UNSET_RECURSIVE( d, [" + this._getOmitInstruction(options) + "])";
    // } else {
    //   query += " RETURN d";
    // }

    query += ' RETURN d'

    if (this._printQuery(options)) {
      console.log(query)
      console.log(params)
      console.log('')
    }

    return {
      query,
      bindVars: params
    }
  }

  public fetchAll(
    collection: string,
    options: FetchOptions = {}
  ): AqlQuery {
    const params: any = {}
    let query = 'FOR d IN ' + collection

    // TODO: enable and document this ??
    // if (options.restrictTo) {
    //   params.restrictTo = options.restrictTo
    //   query += ' FILTER d.@restrictTo'
    // }

    // TODO: Support sorting by multiple criteria ...
    // SORT u.lastName, u.firstName, u.id DESC
    if (options?.hasOwnProperty('sortBy')) {
      query += ` SORT d.${options.sortBy}`

      if (options.hasOwnProperty('sortOrder')) {
        if (options.sortOrder === 'ascending') {
          query += ' ASC'
        } else if (options.sortOrder === 'descending') {
          query += ' DESC'
        }
      }
    }

    if (options.limit && options.limit > 0) {
      if (options.offset) {
        query += ` LIMIT ${options.offset}, ${options.limit}`
      } else {
        query += ` LIMIT ${options.limit}`
      }
    }

    // if (this._hasOmitOption(options)) {
    //   query += " RETURN UNSET_RECURSIVE( d, [" + this._getOmitInstruction(options) + "])";
    // } else {
    //   query += " RETURN d";
    // }

    query += ' RETURN d'

    return {
      query,
      bindVars: params
    }
  }

  public updateDocumentsByKeyValue(collection: DocumentCollection, identifier: PropertyValue, data: any): AqlQuery {
    // return literal(
    //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" UPDATE d WITH ${JSON.stringify(
    //     data
    //   )} IN ${collection} RETURN { _key: NEW._key, _id: NEW._id, _rev: NEW._rev, _oldRev: OLD._rev }`
    // )

    return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.property} == ${identifier.value}
      UPDATE d WITH ${data} IN ${collection}
      RETURN { _key: NEW._key }`

    //
    // Some examples of using aql and helpers - from the docs
    //
    // var query = "FOR doc IN collection";
    // var params = {};
    // if (useFilter) {
    //   query += " FILTER doc.value == @what";
    //   params.what = req.params("searchValue");
    // }

    // const filter = aql`FILTER d.color == ${color}'`
    // const result = await db.query(aql`
    //   FOR d IN ${collection}
    //   ${filter}
    //   RETURN d
    // `)

    // const filters = []
    // if (adminsOnly) filters.push(aql`FILTER user.admin`)
    // if (activeOnly) filters.push(aql`FILTER user.active`)
    // const result = await db.query(aql`
    //   FOR user IN ${users}
    //   ${join(filters)}
    //   RETURN user
    // `)
  }

  public deleteDocumentsByKeyValue(collection: DocumentCollection, identifier: PropertyValue): AqlQuery {
    // return literal(
    //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" REMOVE d IN ${collection} RETURN { _key: d._key, _id: d._id, _rev: d._rev }`
    // )

    return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.property} == ${identifier.value}
      REMOVE d IN ${collection}
      RETURN { _key: d._key }`
  }

  public uniqueConstraintQuery(constraints: UniqueConstraint): AqlQuery {
    if (!constraints || constraints.constraints.length === 0) {
      throw new Error('No constraints specified')
    }

    const params: any = {}
    let query = `FOR d IN ${constraints.collection} FILTER`

    if (constraints.excludeDocumentKey) {
      params.excludeDocumentKey = constraints.excludeDocumentKey
      query += ' d._key != @excludeDocumentKey FILTER'
    }

    let constraintCount = 0

    for (const constraint of constraints.constraints) {
      constraintCount++

      if (constraintCount > 1) {
        query += ' ||'
      }

      if (isCompositeKey(constraint)) {
        let keyCount = 0

        query += ' ('

        for (const kv of constraint.composite) {
          keyCount++

          if (keyCount > 1) {
            query += ' &&'
          }

          if (constraints.caseInsensitive) {
            const keyParam = `${kv.property}_key_${keyCount}`
            const valueParam = `${kv.property}_val_${keyCount}`

            params[keyParam] = kv.property
            params[valueParam] = kv.value

            query += ` d.@${keyParam} == @${valueParam}`
          } else {
            const keyParam = `${kv.property}_key_${keyCount}`
            const valueParam = `${kv.property}_val_${keyCount}`

            params[keyParam] = kv.property

            if (typeof kv.value === 'string') {
              params[valueParam] = kv.value.toLowerCase()
            } else {
              params[valueParam] = kv.value
            }

            query += ` LOWER(d.@${keyParam}) == @${valueParam}`
          }
        }

        query += ' )'
      }

      if (isUniqueValue(constraint)) {
        const keyParam = `${constraint.unique.property}_key`
        const valueParam = `${constraint.unique.property}_val`

        if (constraints.caseInsensitive) {
          params[keyParam] = constraint.unique.property
          params[valueParam] = constraint.unique.value

          query += ` d.@${keyParam} == @${valueParam}`
        } else {
          params[keyParam] = constraint.unique.property

          if (typeof constraint.unique.value === 'string') {
            params[valueParam] = constraint.unique.value.toLowerCase()
          } else {
            params[valueParam] = constraint.unique.value
          }

          query += ` LOWER(d.@${keyParam}) == @${valueParam}`
        }
      }
    }

    query += ' RETURN d._key'

    return {
      query,
      bindVars: params
    }
  }
}

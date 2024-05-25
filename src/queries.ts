/* eslint-disable no-prototype-builtins */
import { aql, AqlQuery } from 'arangojs/aql'
import { DocumentCollection } from 'arangojs/collection'
import {
  UniqueConstraint,
  isCompositeKey,
  isUniqueValue,
  KeyValue,
  IndexedValue,
  Search,
  Filter,
  Criteria,
  MatchTypeOperator,
  MatchType,
  FetchOptions,
  GuacamoleOptions
} from './index'

/** @internal */
// function _debugFilters(options: FetchOptions, debugVal: string): string | undefined {
//   if (options.debugFilters) {
//     return debugVal
//   }

//   return undefined
// }

/** @internal */
export function isFilter(x: any): x is Filter {
  return x.filters
}

/** @internal */
export function isSearch(x: any): x is Search {
  return x.terms
}

/** @internal */
export function _findAllIndicesOfSubString(
  subString: string | string[],
  targetString: string,
  caseInSensitive = true
): IndexedValue[] {
  if (Array.isArray(subString)) {
    let indices: IndexedValue[] = []

    for (const s of subString) {
      indices = indices.concat(_findAllIndicesOfSubString(s, targetString, caseInSensitive))
    }

    return indices.sort(function (a: any, b: any) {
      return a.index > b.index ? 1 : -1
    })
  }

  if (targetString.length === 0) {
    return []
  }

  if (caseInSensitive) {
    targetString = targetString.toLowerCase()
    subString = subString.toLowerCase()
  }

  const indices: IndexedValue[] = []

  let index = targetString.indexOf(subString)
  while (index !== -1) {
    indices.push({ index, value: subString })
    index = targetString.indexOf(subString, index + 1)
  }

  return indices
}

/** @internal */
export function _prefixPropertNameInFilterToken(filterStringToken: string): string {
  if (filterStringToken.includes('(')) {
    const tmp = filterStringToken.replace(/\(\s*/, '(d.')
    return tmp.replace(/\s*\)/g, ')')
  }

  if (filterStringToken.includes(')')) {
    return 'd.' + filterStringToken.replace(/\s*\)/, ')')
  }

  // check for a value in an array property
  // the opposite would be to check that the value of a property is found in a passed array,
  // d.propval IN ['my','array']
  if (filterStringToken.includes(' IN_PROP ')) {
    return filterStringToken.replace(/\s*IN_PROP\s*/, ' IN d.')
  }

  return 'd.' + filterStringToken
}

/** @internal */
export function _prefixPropertyNames(filterString: string): string {
  // split filter string into tokens, delimited by logical operators,
  // so that the lefthand operands (the variables) can be prefixed with d.
  // const validLogicalOperators = ["||", "&&", "AND", "OR"];
  const validLogicalOperators = ['||', '&&']

  const logicalOperatorIndices = _findAllIndicesOfSubString(validLogicalOperators, filterString)

  if (logicalOperatorIndices.length === 0) {
    return _prefixPropertNameInFilterToken(filterString)
  }

  let modifiedFilter: string = ''
  let stringIndex = 0

  for (let i = 0; i <= logicalOperatorIndices.length; i++) {
    // The <= is intentional. We need to add one iteration beyond the number of operators,
    // so that the last filter expression can be included in the string build
    let partialFilterString: string
    let logicalOperator: string | undefined

    if (i === logicalOperatorIndices.length) {
      partialFilterString = filterString.substring(stringIndex).trim()
    } else {
      partialFilterString = filterString.substring(stringIndex, logicalOperatorIndices[i].index).trim()
      logicalOperator = filterString.substring(
        logicalOperatorIndices[i].index,
        logicalOperatorIndices[i].index + logicalOperatorIndices[i].value.length
      )
      stringIndex = logicalOperatorIndices[i].index + logicalOperatorIndices[i].value.length
    }

    modifiedFilter += _prefixPropertNameInFilterToken(partialFilterString)

    if (logicalOperator) {
      modifiedFilter += ' ' + logicalOperator + ' '
    }
  }

  return modifiedFilter
}

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
  private _shouldPrefixPropNames(options?: FetchOptions): boolean {
    if (options?.autoPrefixPropNamesInFilters === true || options?.autoPrefixPropNamesInFilters === false) {
      return options.autoPrefixPropNamesInFilters
    }

    if (this.go && this.go.autoPrefixPropNamesInFilters === true) {
      return true
    }

    return false
  }

  /** @internal */
  private _toFilter(search: Search, options?: FetchOptions): Filter {
    const filter: Filter = {
      match: MatchType.ANY,
      filters: []
    }

    if (typeof search.props === 'string') {
      search.props = search.props.split(',')
    }

    if (!this._shouldPrefixPropNames(options)) {
      search.props = search.props.map(p => `d.${p}`)
    }

    if (typeof search.terms === 'string') {
      search.terms = search.terms.split(',')
    }

    for (let i = 0; i < search.props.length; i++) {
      for (let j = 0; j < search.terms.length; j++) {
        if (search.terms[j].trim().toLowerCase() === 'null') {
          filter.filters.push(search.props[i].trim() + ' == null')
        } else if (search.terms[j].trim().toLowerCase() === '!null') {
          filter.filters.push(search.props[i].trim() + ' != null')
        } else {
        // filters.push(fields[i].trim() + ' LIKE "%' + search.trim() + '%"');
          filter.filters.push('LIKE(' + search.props[i].trim() + ', "%' + search.terms[j].trim() + '%", true)')
        }
      }
    }

    return filter
  }

  /** @internal */
  private _fetchByKeyValue(
    collection: string,
    identifier: KeyValue | KeyValue[],
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

        if (kv.name.indexOf('.') > 0) {
          params[keyParam] = kv.name.split('.')
        } else {
          params[keyParam] = kv.name
        }
        params[valueParam] = kv.value

        query += ` d.@${keyParam} == @${valueParam}`
      }
    } else {
      if (identifier.name.indexOf('.') > 0) {
        params.p = identifier.name.split('.')
      } else {
        params.p = identifier.name
      }

      params.v = identifier.value
      query += ' d.@p == @v'
    }

    if (criteria?.filter && criteria.search) {
      query += ' ) AND ( ( '
    } else if (criteria && (criteria.filter ?? criteria.search)) {
      query += ' ) AND ( '
    }

    if (criteria) {
      if (criteria.filter) {
        if (isFilter(criteria.filter)) {
          const matchType: MatchType = criteria.filter.match ? criteria.filter.match : MatchType.ANY

          for (let i = 0; i < criteria.filter.filters.length; i++) {
            if (i > 0) {
              query += ` ${MatchTypeOperator[matchType]} `
            }
            if (this._shouldPrefixPropNames(options)) {
              query += _prefixPropertNameInFilterToken(criteria.filter.filters[i])
            } else {
              query += criteria.filter.filters[i]
            }
          }
        } else {
          if (this._shouldPrefixPropNames(options)) {
            query += _prefixPropertyNames(criteria.filter)
          } else {
            query += criteria.filter
          }
        }
      }

      if (criteria.filter && criteria.search) {
        const matchType: MatchType = criteria.match ? criteria.match : MatchType.ANY
        query += ` ) ${MatchTypeOperator[matchType]} ( `
      }

      if (criteria.search) {
        const filter: Filter = this._toFilter(criteria.search, options)

        for (let i = 0; i < filter.filters.length; i++) {
          if (i > 0) {
            query += ` ${MatchTypeOperator[MatchType.ANY]} `
          }
          if (this._shouldPrefixPropNames(options)) {
            query += _prefixPropertNameInFilterToken(filter.filters[i])
          } else {
            query += filter.filters[i]
          }
        }
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
    identifier: KeyValue,
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
    identifier: KeyValue[],
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
    identifier: KeyValue[],
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
      if (isFilter(criteria.filter)) {
        const matchType: MatchType = criteria.filter.match ? criteria.filter.match : MatchType.ANY
        for (let i = 0; i < criteria.filter.filters.length; i++) {
          if (i > 0) {
            query += ` ${MatchTypeOperator[matchType]} `
          }
          if (this._shouldPrefixPropNames(options)) {
            query += _prefixPropertNameInFilterToken(criteria.filter.filters[i])
          } else {
            query += criteria.filter.filters[i]
          }
        }
      } else {
        if (this._shouldPrefixPropNames(options)) {
          query += _prefixPropertyNames(criteria.filter)
        } else {
          query += criteria.filter
        }
      }
    }

    if (criteria.filter && criteria.search) {
      const matchType: MatchType = criteria.match ? criteria.match : MatchType.ANY
      query += ` ) ${MatchTypeOperator[matchType]} ( `
    }

    if (criteria.search) {
      const filter: Filter = this._toFilter(criteria.search, options)

      for (let i = 0; i < filter.filters.length; i++) {
        if (i > 0) {
          query += ` ${MatchTypeOperator[MatchType.ANY]} `
        }
        if (this._shouldPrefixPropNames(options)) {
          query += _prefixPropertNameInFilterToken(filter.filters[i])
        } else {
          query += filter.filters[i]
        }
      }
    }

    if (criteria.filter && criteria.search) {
      query += ' )'
    }

    query += ' )'

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

  public updateDocumentsByKeyValue(collection: DocumentCollection, identifier: KeyValue, data: any): AqlQuery {
    // return literal(
    //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" UPDATE d WITH ${JSON.stringify(
    //     data
    //   )} IN ${collection} RETURN { _key: NEW._key, _id: NEW._id, _rev: NEW._rev, _oldRev: OLD._rev }`
    // )

    return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.name} == ${identifier.value}
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

  public deleteDocumentsByKeyValue(collection: DocumentCollection, identifier: KeyValue): AqlQuery {
    // return literal(
    //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" REMOVE d IN ${collection} RETURN { _key: d._key, _id: d._id, _rev: d._rev }`
    // )

    return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.name} == ${identifier.value}
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
            const keyParam = `${kv.name}_key_${keyCount}`
            const valueParam = `${kv.name}_val_${keyCount}`

            params[keyParam] = kv.name
            params[valueParam] = kv.value

            query += ` d.@${keyParam} == @${valueParam}`
          } else {
            const keyParam = `${kv.name}_key_${keyCount}`
            const valueParam = `${kv.name}_val_${keyCount}`

            params[keyParam] = kv.name
            params[valueParam] = kv.value.toLowerCase()

            query += ` LOWER(d.@${keyParam}) == @${valueParam}`
          }
        }

        query += ' )'
      }

      if (isUniqueValue(constraint)) {
        const keyParam = `${constraint.unique.name}_key`
        const valueParam = `${constraint.unique.name}_val`

        if (constraints.caseInsensitive) {
          params[keyParam] = constraint.unique.name
          params[valueParam] = constraint.unique.value

          query += ` d.@${keyParam} == @${valueParam}`
        } else {
          params[keyParam] = constraint.unique.name
          params[valueParam] = constraint.unique.value.toLowerCase()

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

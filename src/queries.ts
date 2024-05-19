/* eslint-disable no-prototype-builtins */
import { aql, AqlQuery } from 'arangojs/aql'
import { DocumentCollection } from 'arangojs/collection'
import {
  UniqueConstraint,
  isCompositeKey,
  isUniqueValue,
  KeyValue,
  IndexedValue,
  SearchTerms,
  FilterCriteria,
  MatchTypeOperator,
  MatchType,
  FetchOptions,
  GuacamoleOptions
} from './index'

/** @internal */
export function isFilterCriteria(x: any): x is FilterCriteria {
  return x.filters
}

/** @internal */
export function isSearchTerms(x: any): x is SearchTerms {
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

    if (this.go && this.go.autoPrefixPropNamesInFilters === false) {
      return false
    }

    return true
  }

  /** @internal */
  private _toFilterCriteria(search: SearchTerms, options?: FetchOptions): FilterCriteria {
    const filter: FilterCriteria = {
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
        // filters.push(fields[i].trim() + ' LIKE "%' + searchTerms.trim() + '%"');
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
    options: FetchOptions,
    filter?: string | FilterCriteria | SearchTerms
  ): AqlQuery {
    if (this._printQuery(options) || this._debugFunctions()) {
      console.log(`_fetchByKeyValue: ${collection}`)
      console.log(identifier)
      console.log(filter)
    }

    const params: any = {}
    let query = `FOR d IN ${collection} FILTER`

    if (Array.isArray(identifier)) {
      let keyCount = 0

      // query += " (";

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

    // query += " )";
    } else {
      if (identifier.name.indexOf('.') > 0) {
        params.p = identifier.name.split('.')
      } else {
        params.p = identifier.name
      }

      params.v = identifier.value
      query += '  d.@p == @v'
    }

    if (filter) {
      if (isFilterCriteria(filter) || isSearchTerms(filter)) {
        const criteria: FilterCriteria = isSearchTerms(filter) ? this._toFilterCriteria(filter, options) : filter
        const matchType: MatchType = criteria.match ? criteria.match : MatchType.ANY
        // if (criteria?.match) {}

        // 'FOR d IN users FILTER  d.@property == @value AND FILTER ( LIKE(d.name, "%ba%", true) ) RETURN d'
        // 'FOR d IN users FILTER  d.@property == @value FILTER ( LIKE(d.name, "%ba%", true) ) RETURN d'
        // query += ' AND ( '
        query += ' FILTER ( '

        for (let i = 0; i < criteria.filters.length; i++) {
          if (i > 0) {
            query += ` ${MatchTypeOperator[matchType]} `
          }
          if (this._shouldPrefixPropNames(options)) {
            query += _prefixPropertNameInFilterToken(criteria.filters[i])
          } else {
            query += criteria.filters[i]
          }
        }

        query += ' )'
      } else {
        if (this._shouldPrefixPropNames(options)) {
          query += ' FILTER ( ' + _prefixPropertyNames(filter) + ' )'
        } else {
          query += ' FILTER ( ' + filter + ' )'
        }
      }
    }

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

    query += ' RETURN d'

    if (this._printQuery(options)) {
      console.log(query)
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
    filter?: string | FilterCriteria | SearchTerms
  ): AqlQuery {
    if (this._debugFunctions()) {
      console.log(`fetchByMatchingProperty: ${collection}`)
    }

    return this._fetchByKeyValue(collection, identifier, MatchType.ANY, options, filter)
  }

  public fetchByMatchingAnyProperty(
    collection: string,
    identifier: KeyValue[],
    options: FetchOptions = {},
    filter?: string | FilterCriteria | SearchTerms
  ): AqlQuery {
    if (this._debugFunctions()) {
      console.log(`fetchByMatchingAnyProperty: ${collection}`)
    }

    return this._fetchByKeyValue(collection, identifier, MatchType.ANY, options, filter)
  }

  public fetchByMatchingAllProperties(
    collection: string,
    identifier: KeyValue[],
    options: FetchOptions = {},
    filter?: string | FilterCriteria | SearchTerms
  ): AqlQuery {
    if (this._debugFunctions()) {
      console.log(`fetchByMatchingAllProperties: ${collection}`)
    }

    return this._fetchByKeyValue(collection, identifier, MatchType.ALL, options, filter)
  }

  public fetchByFilterCriteria(
    collection: string,
    filter: string | FilterCriteria | SearchTerms,
    options: FetchOptions = {}
  ): AqlQuery {
    if (this._printQuery(options) || this._debugFunctions()) {
      console.log(`fetchByFilterCriteria: ${collection}`)
      console.log(filter)
    }

    const params: any = {}

    let query = 'FOR d IN ' + collection

    // TODO: enable and document this ??
    // if (options.restrictTo) {
    //   params.restrictTo = options.restrictTo
    //   query += ' FILTER d.@restrictTo'
    // }

    if (isFilterCriteria(filter) || isSearchTerms(filter)) {
      const criteria: FilterCriteria = isSearchTerms(filter) ? this._toFilterCriteria(filter, options) : filter
      const matchType: MatchType = criteria.match ? criteria.match : MatchType.ANY
      // if (criteria?.match) {}

      query += ' FILTER ( '

      for (let i = 0; i < criteria.filters.length; i++) {
        if (i > 0) {
          query += ` ${MatchTypeOperator[matchType]} `
        }
        if (this._shouldPrefixPropNames(options)) {
          query += _prefixPropertNameInFilterToken(criteria.filters[i])
        } else {
          query += criteria.filters[i]
        }
      }

      query += ' )'
    } else {
      if (this._shouldPrefixPropNames(options)) {
        query += ' FILTER ( ' + _prefixPropertyNames(filter) + ' )'
      } else {
        query += ' FILTER ( ' + filter + ' )'
      }
    }

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

/* eslint-disable no-prototype-builtins */
import debug from 'debug'
import { aql, AqlQuery, AqlValue, isAqlQuery, join, literal } from 'arangojs/aql'
import { DocumentCollection, EdgeCollection } from 'arangojs/collection'
import {
  MatchTypeOperator,
  UniqueConstraint,
  isCompositeKey,
  isUniqueValue,
  FetchOptions,
  PropertyValue,
  SearchTerms,
  Filter,
  Criteria,
  MatchType,
  isSearch,
  isFilter
} from './index'

/** @internal */
const debugQueries = debug('guacamole:log:query')
const debugFilters = debug('guacamole:log:filter')

/** @internal */
const _debug = {
  queries: debugQueries,
  filters: debugFilters,
  log: {
    queries: function (data: any) {
      debug.enable('guacamole:log:query')
      debugQueries(data)
      debug.disable()
    },
    filters: function (data: any) {
      debug.enable('guacamole:log:filter')
      debugFilters(data)
      debug.disable()
    }
  }
}

/** @internal */
function _debugFiltersEnabled(options?: FetchOptions): boolean {
  if (options?.debugFilters) {
    return true
  }

  return !!(options?.guacamole?.debugFilters)
}

/** @internal */
function _printQuery(options?: FetchOptions): boolean {
  if (options?.printQuery) {
    return true
  }

  return !!(options?.guacamole?.printQueries)
}

/** @internal */
function _toSearchFilter(search: SearchTerms): Filter {
  const filters: AqlQuery[] = []

  const props = typeof search.properties === 'string'
    ? search.properties.split(',').map(p => p.trim())
    : search.properties.map(p => p.trim())

  const terms = typeof search.terms === 'string'
    ? search.terms.split(',').map(t => t.trim())
    : search.terms.map(t => t.trim())

  for (let i = 0; i < props.length; i++) {
    if (props[i].indexOf('.') > 0) {
      const nestedPropPath: AqlValue[] = []

      nestedPropPath.push(literal('d'))

      const nestedProps = props[i].split('.')
      for (let i = 0; i < nestedProps.length; i++) {
        nestedPropPath.push(aql`.${nestedProps[i]}`)
      }

      for (let j = 0; j < terms.length; j++) {
        const termsFilter: AqlValue[] = []
        if (terms[j] === 'null' || terms[j] === 'NULL') {
          termsFilter.push(join(nestedPropPath, ''))
          termsFilter.push(literal(' == null'))
        } else if (terms[j] === '!null' || terms[j] === '!NULL') {
          termsFilter.push(join(nestedPropPath, ''))
          termsFilter.push(literal(' != null'))
        } else {
          termsFilter.push(literal('LIKE('))
          termsFilter.push(join(nestedPropPath, ''))
          termsFilter.push(aql`, ${'%' + terms[j].trim() + '%'}, true)`)
          // termsFilter.push(aql`LIKE(d.${props[i]}, ${'%' + terms[j].trim() + '%'}, true)`)
        }

        filters.push(join(termsFilter, ''))
      }
    } else {
      for (let j = 0; j < terms.length; j++) {
        if (terms[j] === 'null' || terms[j] === 'NULL') {
          filters.push(aql`d.${props[i]} == null`)
        } else if (terms[j] === '!null' || terms[j] === '!NULL') {
          filters.push(aql`d.${props[i]} != null`)
        } else {
          filters.push(aql`LIKE(d.${props[i]}, ${'%' + terms[j].trim() + '%'}, true)`)
        }
      }
    }
  }

  return {
    match: search.match ? search.match : MatchType.ANY,
    filters
  }
}

/** @internal */
function _toAqlFilters(filter: string | AqlValue | Filter | SearchTerms): AqlValue {
  if (typeof filter === 'string') {
    return literal(filter)
  }

  if (isAqlQuery(filter)) {
    return filter
  }

  if (isSearch(filter)) {
    return _toAqlFilters(_toSearchFilter(filter))
  }

  if (!isFilter(filter)) {
    throw new Error('Invalid input received for filter string conversion')
  }

  const filters: AqlValue[] = []

  const matchType: MatchType = filter.match ? filter.match : MatchType.ANY
  for (let i = 0; i < filter.filters.length; i++) {
    if (i > 0) {
      filters.push(literal(` ${MatchTypeOperator[matchType]} `))
    }

    if (isAqlQuery(filter.filters[i])) {
      filters.push(filter.filters[i])
    } else { // if (typeof filter.filters[i] === 'string')
      filters.push(literal(filter.filters[i] as string))
    }
  }

  return join(filters, '')
}

/** @internal */
function _toQueryOpts(options: FetchOptions = {}): AqlValue[] {
  const opts: AqlValue[] = []

  if (options.hasOwnProperty('sortBy')) {
    opts.push(aql` SORT d.${options.sortBy}`)

    if (options.hasOwnProperty('sortOrder')) {
      if (options.sortOrder === 'ascending') {
        opts.push(literal(' ASC'))
      } else if (options.sortOrder === 'descending') {
        opts.push(literal(' DESC'))
      }
    }
  }

  // getting unexpected results when using `aql` here instead of literal
  if (options.limit && options.limit > 0) {
    if (options.offset) {
      opts.push(literal(` LIMIT ${options.offset}, ${options.limit}`))
    } else {
      opts.push(literal(` LIMIT ${options.limit}`))
    }
  }

  return opts
}

/** @internal */
function _toPropertyFilter(prop: PropertyValue): AqlQuery {
  const f: AqlValue[] = []

  if (prop.property.indexOf('.') > 0) {
    if (prop.options?.caseSensitive ?? typeof prop.value !== 'string') {
      f.push(literal(' d'))
    } else {
      f.push(literal(' LOWER(d'))
    }

    const nestedProps = prop.property.split('.')

    for (let i = 0; i < nestedProps.length; i++) {
      f.push(aql`.${nestedProps[i]}`)
    }

    if (prop.options?.caseSensitive ?? typeof prop.value !== 'string') {
      f.push(aql` == ${prop.value}`)
    } else {
      f.push(aql`) == ${prop.value.toLowerCase()}`)
    }
  } else {
    if (prop.options?.caseSensitive ?? typeof prop.value !== 'string') {
      f.push(aql` d.${prop.property} == ${prop.value}`)
    } else {
      f.push(aql` LOWER(d.${prop.property}) == ${prop.value.toLowerCase()}`)
    }
  }

  return join(f)
}

function fetchByPropertyValues(
  collection: DocumentCollection | EdgeCollection,
  properties: PropertyValue | PropertyValue[],
  match: MatchType,
  criteria?: Criteria,
  options: FetchOptions = {}
): AqlQuery {
  if (_debugFiltersEnabled(options)) {
    _debug.log.filters(properties)
    if (Array.isArray(properties)) {
      _debug.log.filters(`MATCH: ${match}`)
    }
    _debug.log.filters(criteria)
  } else {
    _debug.filters(properties)
    if (Array.isArray(properties)) {
      _debug.filters(`MATCH: ${match}`)
    }
    _debug.filters(criteria)
  }

  const filters: AqlValue[] = []

  if (criteria && (criteria.filter ?? criteria.search)) {
    filters.push(literal(' ('))
  }

  if (Array.isArray(properties)) {
    let propCount = 0

    for (const prop of properties) {
      propCount++
      if (propCount > 1) {
        filters.push(literal(` ${MatchTypeOperator[match]}`))
      }

      filters.push(_toPropertyFilter(prop))
    }
  } else {
    filters.push(_toPropertyFilter(properties))
  }

  if (criteria?.filter && criteria.search) {
    filters.push(literal(' ) AND ( ('))
  } else if (criteria && (criteria.filter ?? criteria.search)) {
    filters.push(literal(' ) AND ('))
  }

  if (criteria) {
    if (criteria.filter) {
      filters.push(literal(' '))
      filters.push(_toAqlFilters(criteria.filter))
    }

    if (criteria.filter && criteria.search) {
      filters.push(literal(` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `))
    }

    if (criteria.search) {
      filters.push(literal(' '))
      filters.push(_toAqlFilters(criteria.search))
    }
  }

  if (criteria?.filter && criteria.search) {
    filters.push(literal(' ) )'))
  } else if (criteria && (criteria.filter ?? criteria.search)) {
    filters.push(literal(' )'))
  }

  if (filters.length === 0) {
    throw new Error('Unexpected input received for query construction')
  }

  const opts = _toQueryOpts(options)

  const query = opts.length > 0
    ? aql`FOR d IN ${collection} FILTER (${join(filters, '')} )${join(opts, '')} RETURN d`
    : aql`FOR d IN ${collection} FILTER (${join(filters, '')} ) RETURN d`

  if (_debugFiltersEnabled(options) || _printQuery(options)) {
    _debug.log.queries(query)
  } else {
    _debug.queries(query)
  }

  return query
}

export function fetchByMatchingProperty(
  collection: DocumentCollection | EdgeCollection,
  identifier: PropertyValue,
  options: FetchOptions = {},
  criteria?: Criteria
): AqlQuery {
  return fetchByPropertyValues(collection, identifier, MatchType.ANY, criteria, options)
}

export function fetchByMatchingAnyProperty(
  collection: DocumentCollection | EdgeCollection,
  identifier: PropertyValue[],
  options: FetchOptions = {},
  criteria?: Criteria
): AqlQuery {
  return fetchByPropertyValues(collection, identifier, MatchType.ANY, criteria, options)
}

export function fetchByMatchingAllProperties(
  collection: DocumentCollection | EdgeCollection,
  identifier: PropertyValue[],
  options: FetchOptions = {},
  criteria?: Criteria
): AqlQuery {
  return fetchByPropertyValues(collection, identifier, MatchType.ALL, criteria, options)
}

export function fetchByCriteria(
  collection: DocumentCollection | EdgeCollection,
  criteria: Criteria,
  options: FetchOptions = {}
): AqlQuery {
  if (_debugFiltersEnabled(options)) {
    _debug.log.filters(criteria)
  } else {
    _debug.filters(criteria)
  }

  const filters: AqlValue[] = []

  if (criteria.filter && criteria.search) {
    filters.push(literal(' ( '))
  }

  if (criteria.filter) {
    filters.push(literal(' '))
    filters.push(_toAqlFilters(criteria.filter))
  }

  if (criteria.filter && criteria.search) {
    filters.push(literal(` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `))
  }

  if (criteria.search) {
    filters.push(literal(' '))
    filters.push(_toAqlFilters(criteria.search))
  }

  if (criteria.filter && criteria.search) {
    filters.push(literal(' )'))
  }

  if (filters.length === 0) {
    throw new Error('Unexpected input received for query construction')
  }

  const opts = _toQueryOpts(options)

  const query = opts.length > 0
    ? aql`FOR d IN ${collection} FILTER (${join(filters, '')} )${join(opts, '')} RETURN d`
    : aql`FOR d IN ${collection} FILTER (${join(filters, '')} ) RETURN d`

  // if (_hasOmitOption(options)) {
  //   query += " RETURN UNSET_RECURSIVE( d, [" + _getOmitInstruction(options) + "])";
  // } else {
  //   query += " RETURN d";
  // }

  if (_debugFiltersEnabled(options) || _printQuery(options)) {
    _debug.log.queries(query)
  } else {
    _debug.queries(query)
  }

  return query
}

// TODO: turn this into safe AQL
export function fetchAll(
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

  // if (_hasOmitOption(options)) {
  //   query += " RETURN UNSET_RECURSIVE( d, [" + _getOmitInstruction(options) + "])";
  // } else {
  //   query += " RETURN d";
  // }

  query += ' RETURN d'

  return {
    query,
    bindVars: params
  }
}

export function updateDocumentsByKeyValue(
  collection: DocumentCollection,
  identifier: PropertyValue,
  data: any
): AqlQuery {
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

export function deleteDocumentsByKeyValue(collection: DocumentCollection, identifier: PropertyValue): AqlQuery {
  // return literal(
  //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" REMOVE d IN ${collection} RETURN { _key: d._key, _id: d._id, _rev: d._rev }`
  // )

  return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.property} == ${identifier.value}
      REMOVE d IN ${collection}
      RETURN { _key: d._key }`
}

// TODO: turn this into safe AQL
export function uniqueConstraintQuery(constraints: UniqueConstraint): AqlQuery {
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
      let propCount = 0

      query += ' ('

      for (const kv of constraint.composite) {
        propCount++

        if (propCount > 1) {
          query += ' &&'
        }

        if (constraints.caseInsensitive) {
          const bindProp = `${kv.property}_key_${propCount}`
          const bindValue = `${kv.property}_val_${propCount}`

          params[bindProp] = kv.property
          params[bindValue] = kv.value

          query += ` d.@${bindProp} == @${bindValue}`
        } else {
          const bindProp = `${kv.property}_key_${propCount}`
          const bindValue = `${kv.property}_val_${propCount}`

          params[bindProp] = kv.property

          if (typeof kv.value === 'string') {
            params[bindValue] = kv.value.toLowerCase()
            query += ` LOWER(d.@${bindProp}) == @${bindValue}`
          } else {
            params[bindValue] = kv.value
            query += ` d.@${bindProp} == @${bindValue}`
          }
        }
      }

      query += ' )'
    }

    if (isUniqueValue(constraint)) {
      const bindProp = `${constraint.unique.property}_key`
      const bindValue = `${constraint.unique.property}_val`

      if (constraints.caseInsensitive) {
        params[bindProp] = constraint.unique.property
        params[bindValue] = constraint.unique.value

        query += ` d.@${bindProp} == @${bindValue}`
      } else {
        params[bindProp] = constraint.unique.property

        if (typeof constraint.unique.value === 'string') {
          params[bindValue] = constraint.unique.value.toLowerCase()
          query += ` LOWER(d.@${bindProp}) == @${bindValue}`
        } else {
          params[bindValue] = constraint.unique.value
          query += ` d.@${bindProp} == @${bindValue}`
        }
      }
    }
  }

  query += ' RETURN d._key'

  return {
    query,
    bindVars: params
  }
}

export const Queries = {
  fetchAll,
  fetchByCriteria,
  fetchByMatchingProperty,
  fetchByMatchingAnyProperty,
  fetchByMatchingAllProperties,
  uniqueConstraintQuery,
  updateDocumentsByKeyValue,
  deleteDocumentsByKeyValue
}

// function _toAqlFiltersOriginal(filter: string | AqlValue | Filter | SearchTerms): AqlValue[] {
//   if (typeof filter === 'string') {
//     return [literal(filter)]
//   }

//   if (isAqlQuery(filter)) {
//     return [filter]
//   }

//   if (isSearch(filter)) {
//     return _toAqlFilters(_toSearchFilter(filter))
//   }

//   if (!isFilter(filter)) {
//     throw new Error('Invalid input received for filter string conversion')
//   }

//   console.log('OK')
//   console.log(filter.filters)
//   const filters: AqlValue[] = []

//   const matchType: MatchType = filter.match ? filter.match : MatchType.ANY
//   for (let i = 0; i < filter.filters.length; i++) {
//     if (i > 0) {
//       console.log('SUP YO')
//       filters.push(literal(` ${MatchTypeOperator[matchType]}`))
//     }

//     const f = filter.filters[i]

//     if (isAqlQuery(f)) {
//       filters.push(f)
//     } else { // if (typeof filter.filters[i] === 'string')
//       filters.push(literal(f))
//     }
//   }
//   console.log(filters)

//   return filters
// }

// function _fetchByPropertyValuesOriginal(
//   collection: string,
//   properties: PropertyValue | PropertyValue[],
//   match: MatchType,
//   criteria?: Criteria,
//   options: FetchOptions = {}
// ): AqlQuery {
//   if (_printQuery(options) || _debugFiltersEnabled(options)) {
//     console.log(`fetchByPropertyValues: ${collection}`)
//     console.log(properties)
//     console.log(match)
//     if (criteria) {
//       console.dir(criteria)
//     }
//   }

//   const params: any = {
//     '@collection': collection
//   }

//   let query = 'FOR d IN @@collection FILTER ('

//   if (criteria && (criteria.filter ?? criteria.search)) {
//     query += ' ('
//   }

//   if (Array.isArray(properties)) {
//     let propCount = 0

//     for (const kv of properties) {
//       propCount++

//       if (propCount > 1) {
//         query += ` ${MatchTypeOperator[match]}`
//       }

//       const bindProp = `p${propCount}`
//       const bindValue = `v${propCount}`

//       if (kv.property.indexOf('.') > 0) {
//         params[bindProp] = kv.property.split('.')
//       } else {
//         params[bindProp] = kv.property
//       }

//       if (kv.options?.caseSensitive ?? typeof kv.value !== 'string') {
//         params[bindValue] = kv.value
//         query += ` d.@${bindProp} == @${bindValue}`
//       } else {
//         params[bindValue] = kv.value.toLowerCase()
//         query += ` LOWER(d.@${bindProp}) == @${bindValue}`
//       }
//     }
//   } else {
//     if (properties.property.indexOf('.') > 0) {
//       params.p = properties.property.split('.')
//     } else {
//       params.p = properties.property
//     }

//     if (properties.options?.caseSensitive ?? typeof properties.value !== 'string') {
//       params.v = properties.value
//       query += ' d.@p == @v'
//     } else {
//       params.v = properties.value.toLowerCase()
//       query += ' LOWER(d.@p) == @v'
//     }
//   }

//   if (criteria?.filter && criteria.search) {
//     query += ' ) AND ( ( '
//   } else if (criteria && (criteria.filter ?? criteria.search)) {
//     query += ' ) AND ( '
//   }

//   if (criteria) {
//     if (criteria.filter) {
//       query += _toAqlFilters(criteria.filter)
//     }

//     if (criteria.filter && criteria.search) {
//       query += ` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `
//       // query += ` ) ${criteria.match ? criteria.match : MatchType.ANY} ( `
//     }

//     if (criteria.search) {
//       query += _toAqlFilters(criteria.search)
//     }
//   }

//   if (criteria?.filter && criteria.search) {
//     query += ' ) )'
//   } else if (criteria && (criteria.filter ?? criteria.search)) {
//     query += ' )'
//   }

//   query += ' )'

//   if (options.hasOwnProperty('sortBy')) {
//     query += ` SORT d.${options.sortBy}`

//     if (options.hasOwnProperty('sortOrder')) {
//       if (options.sortOrder === 'ascending') {
//         query += ' ASC'
//       } else if (options.sortOrder === 'descending') {
//         query += ' DESC'
//       }
//     }
//   }

//   if (options.limit && options.limit > 0) {
//     if (options.offset) {
//       query += ` LIMIT ${options.offset}, ${options.limit}`
//     } else {
//       query += ` LIMIT ${options.limit}`
//     }
//   }

//   query += ' RETURN d'

//   if (_printQuery(options)) {
//     console.log(query)
//     console.log(params)
//     console.log('')
//   }

//   return {
//     query,
//     bindVars: params
//   }
// }

// export function fetchByCriteriaOriginal(
//   collection: string,
//   criteria: Criteria,
//   options: FetchOptions = {}
// ): AqlQuery {
//   if (_printQuery(options) || _debugFiltersEnabled(options)) {
//     console.log(`fetchByCriteria: ${collection}`)
//     if (criteria) {
//       console.dir(criteria)
//     }
//   }

//   const params: any = {}

//   let query = `FOR d IN ${collection} FILTER ( `

//   if (criteria.filter && criteria.search) {
//     query += '( '
//   }

//   if (criteria.filter) {
//     query += _toAqlFilters(criteria.filter)
//   }

//   if (criteria.filter && criteria.search) {
//     query += ` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `
//     // query += ` ) ${criteria.match ? criteria.match : MatchType.ANY} ( `
//   }

//   if (criteria.search) {
//     query += _toAqlFilters(criteria.search)
//   }

//   if (criteria.filter && criteria.search) {
//     query += ' )'
//   }

//   query += ' )'

//   if (options?.hasOwnProperty('sortBy')) {
//     query += ` SORT d.${options.sortBy}`

//     if (options.hasOwnProperty('sortOrder')) {
//       if (options.sortOrder === 'ascending') {
//         query += ' ASC'
//       } else if (options.sortOrder === 'descending') {
//         query += ' DESC'
//       }
//     }
//   }

//   if (options.limit && options.limit > 0) {
//     if (options.offset) {
//       query += ` LIMIT ${options.offset}, ${options.limit}`
//     } else {
//       query += ` LIMIT ${options.limit}`
//     }
//   }

//   // if (_hasOmitOption(options)) {
//   //   query += " RETURN UNSET_RECURSIVE( d, [" + _getOmitInstruction(options) + "])";
//   // } else {
//   //   query += " RETURN d";
//   // }

//   query += ' RETURN d'

//   if (_printQuery(options)) {
//     console.log(query)
//     console.log(params)
//     console.log('')
//   }

//   return {
//     query,
//     bindVars: params
//   }
// }

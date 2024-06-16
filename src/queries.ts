import debug from 'debug'
import { aql, AqlQuery, AqlValue, isAqlQuery, join, literal } from 'arangojs/aql'
import { DocumentCollection, EdgeCollection } from 'arangojs/collection'
import {
  MatchTypeOperator,
  UniqueConstraint,
  Identifier,
  FetchOptions,
  PropertyValue,
  SearchTerms,
  Filter,
  Criteria,
  MatchType,
  isSearch,
  isFilter,
  GraphFetchInstruction,
  GraphFetchStrategy
} from './types'

const debugQueries = debug('guacamole:log:query')
const debugFilters = debug('guacamole:log:filter')

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

// function _toPrintableQuery(query: string): string {
//   if (query.includes('..')) {
//     return query.replace(/\.\./g, 'xx')
//   }

//   return query
// }

/** @internal */
function _debugFiltersEnabled(options: FetchOptions | undefined): boolean {
  if (options?.debugFilters) {
    return true
  }

  return !!(options?.guacamole?.debugFilters)
}

/** @internal */
function _printQuery(options: FetchOptions | undefined): boolean {
  if (options?.printQuery) {
    return true
  }

  return !!(options?.guacamole?.printQueries)
}

/** @internal */
function _toSearchFilter(search: SearchTerms): Filter {
  if (!search?.properties || !search.terms) {
    return {
      filters: []
    }
  }

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
function _toAqlFilter(filter: string | Filter | SearchTerms | AqlValue): AqlValue {
  if (!filter) {
    return undefined
  }

  if (typeof filter === 'string') {
    return literal(filter)
  }

  if (isAqlQuery(filter)) {
    return filter
  }

  if (isSearch(filter)) {
    return _toAqlFilter(_toSearchFilter(filter))
  }

  if (!isFilter(filter)) {
    throw new Error('Invalid input received for filter string conversion')
  }

  if (!filter.filters || !Array.isArray(filter.filters) || filter.filters.length === 0) {
    return undefined
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
function _toQueryOpts(options: FetchOptions | undefined): AqlValue[] {
  const opts: AqlValue[] = []

  if (!options) {
    return opts
  }

  if (options.sortBy) {
    opts.push(aql` SORT d.${options.sortBy}`)
    if (options.sortOrder && options.sortOrder.toLowerCase() === 'ascending') {
      opts.push(literal(' ASC'))
    } else if (options.sortOrder && options.sortOrder.toLowerCase() === 'descending') {
      opts.push(literal(' DESC'))
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

  // an undocumented graceful lenience ... 'name' will also work instead of 'property'
  const accessor = prop.property ? 'property' : 'name'

  if (prop[accessor].indexOf('.') > 0) {
    if (prop.caseSensitive ?? typeof prop.value !== 'string') {
      f.push(literal(' d'))
    } else {
      f.push(literal(' LOWER(d'))
    }

    const nestedProps = prop[accessor].split('.')

    for (let i = 0; i < nestedProps.length; i++) {
      f.push(aql`.${nestedProps[i]}`)
    }

    if (prop.caseSensitive ?? typeof prop.value !== 'string') {
      f.push(aql` == ${prop.value}`)
    } else {
      f.push(aql`) == ${prop.value.toLowerCase()}`)
    }
  } else {
    if (prop.caseSensitive ?? typeof prop.value !== 'string') {
      f.push(aql` d.${prop[accessor]} == ${prop.value}`)
    } else {
      f.push(aql` LOWER(d.${prop[accessor]}) == ${prop.value.toLowerCase()}`)
    }
  }

  return join(f)
}

/** @internal */
function fetchByPropertyValues(
  collection: DocumentCollection | EdgeCollection,
  properties: PropertyValue | PropertyValue[],
  match: MatchType,
  criteria?: Criteria,
  options?: FetchOptions
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
      const filter = _toAqlFilter(criteria.filter)
      if (filter) {
        filters.push(literal(' '))
        filters.push(filter)
      }
    }

    if (criteria.filter && criteria.search) {
      filters.push(literal(` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `))
    }

    if (criteria.search) {
      const filter = _toAqlFilter(criteria.search)
      if (filter) {
        filters.push(literal(' '))
        filters.push(filter)
      }
    }
  }

  if (criteria?.filter && criteria.search) {
    filters.push(literal(' ) )'))
  } else if (criteria && (criteria.filter ?? criteria.search)) {
    filters.push(literal(' )'))
  }

  if (filters.length === 0) {
    throw new Error('No filters received for valid query construction')
  }

  const trim: AqlValue[] = []

  if (options?.trim?.keep) {
    if (Array.isArray(options.trim.keep)) {
      trim.push(literal(`KEEP(d, "${options.trim.keep.join('", "')}")`))
    } else {
      trim.push(literal(`KEEP(d, "${options.trim.keep}")`))
    }
  } else if (options?.trim?.omit) {
    if (Array.isArray(options?.trim.omit)) {
      trim.push(literal(`UNSET_RECURSIVE(d, "${options.trim.omit.join('", "')}")`))
    } else {
      trim.push(literal(`UNSET_RECURSIVE(d, "${options.trim.omit}")`))
    }
  } else {
    trim.push(literal('d'))
  }

  const opts = _toQueryOpts(options)

  const query = opts && opts.length > 0
    ? aql`FOR d IN ${collection} FILTER (${join(filters, '')} )${join(opts, '')} RETURN ${join(trim, '')}`
    : aql`FOR d IN ${collection} FILTER (${join(filters, '')} ) RETURN ${join(trim, '')}`

  if (_debugFiltersEnabled(options) || _printQuery(options)) {
    _debug.log.queries(query)
  } else {
    _debug.queries(query)
  }

  return query
}

export function fetchByMatchingProperty(
  collection: DocumentCollection | EdgeCollection,
  property: PropertyValue,
  options?: FetchOptions,
  criteria?: Criteria
): AqlQuery {
  return fetchByPropertyValues(collection, property, MatchType.ANY, criteria, options)
}

export function fetchByMatchingAnyProperty(
  collection: DocumentCollection | EdgeCollection,
  property: PropertyValue[],
  options?: FetchOptions,
  criteria?: Criteria
): AqlQuery {
  return fetchByPropertyValues(collection, property, MatchType.ANY, criteria, options)
}

export function fetchByMatchingAllProperties(
  collection: DocumentCollection | EdgeCollection,
  properties: PropertyValue[],
  options?: FetchOptions,
  criteria?: Criteria
): AqlQuery {
  return fetchByPropertyValues(collection, properties, MatchType.ALL, criteria, options)
}

export function fetchByCriteria(
  collection: DocumentCollection | EdgeCollection,
  criteria: Criteria,
  options?: FetchOptions
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
    const filter = _toAqlFilter(criteria.filter)
    if (filter) {
      filters.push(literal(' '))
      filters.push(filter)
    }
  }

  if (criteria.filter && criteria.search) {
    filters.push(literal(` ) ${MatchTypeOperator[criteria.match ? criteria.match : MatchType.ANY]} ( `))
  }

  if (criteria.search) {
    const filter = _toAqlFilter(criteria.search)
    if (filter) {
      filters.push(literal(' '))
      filters.push(filter)
    }
  }

  if (criteria.filter && criteria.search) {
    filters.push(literal(' )'))
  }

  if (filters.length === 0) {
    throw new Error('No filters received for valid query construction')
  }

  const trim: AqlValue[] = []

  if (options?.trim?.keep) {
    if (Array.isArray(options.trim.keep)) {
      trim.push(literal(`KEEP(d, "${options.trim.keep.join('", "')}")`))
    } else {
      trim.push(literal(`KEEP(d, "${options.trim.keep}")`))
    }
  } else if (options?.trim?.omit) {
    if (Array.isArray(options?.trim.omit)) {
      trim.push(literal(`UNSET_RECURSIVE(d, "${options.trim.omit.join('", "')}")`))
    } else {
      trim.push(literal(`UNSET_RECURSIVE(d, "${options.trim.omit}")`))
    }
  } else {
    trim.push(literal('d'))
  }

  const opts = _toQueryOpts(options)

  const query = opts && opts.length > 0
    ? aql`FOR d IN ${collection} FILTER (${join(filters, '')} )${join(opts, '')} RETURN ${join(trim, '')}`
    : aql`FOR d IN ${collection} FILTER (${join(filters, '')} ) RETURN ${join(trim, '')}`

  if (_debugFiltersEnabled(options) || _printQuery(options)) {
    _debug.log.queries(query)
  } else {
    _debug.queries(query)
  }

  return query
}

export function fetchAll(
  collection: DocumentCollection | EdgeCollection,
  options?: FetchOptions
): AqlQuery {
  // TODO: enable and document this ??
  // if (options.restrictTo) {
  //   params.restrictTo = options.restrictTo
  //   query += ' FILTER d.@restrictTo'
  // }

  const trim: AqlValue[] = []

  if (options?.trim?.keep) {
    if (Array.isArray(options.trim.keep)) {
      trim.push(literal(`KEEP(d, "${options.trim.keep.join('", "')}")`))
    } else {
      trim.push(literal(`KEEP(d, "${options.trim.keep}")`))
    }
  } else if (options?.trim?.omit) {
    if (Array.isArray(options?.trim.omit)) {
      trim.push(literal(`UNSET_RECURSIVE(d, "${options.trim.omit.join('", "')}")`))
    } else {
      trim.push(literal(`UNSET_RECURSIVE(d, "${options.trim.omit}")`))
    }
  } else {
    trim.push(literal('d'))
  }

  const opts = _toQueryOpts(options)

  const query = opts && opts.length > 0
    ? aql`FOR d IN ${collection} ${join(opts, '')} RETURN ${join(trim, '')}`
    : aql`FOR d IN ${collection} RETURN ${join(trim, '')}`

  return query
}

export function updateDocumentsByKeyValue(
  collection: DocumentCollection,
  identifier: Identifier,
  data: any
): AqlQuery {
  return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.property} == ${identifier.value}
      UPDATE d WITH ${data} IN ${collection}
      RETURN { _id: NEW._id, _key: NEW._key, _rev: NEW._rev, _oldRev: OLD._rev }`
}

export function deleteDocumentsByKeyValue(
  collection: DocumentCollection,
  identifier: Identifier,
  dependencies?: any[]
): AqlQuery {
  if (dependencies && dependencies.length > 0) {
    const query: AqlValue[] = []

    if (identifier.property) {
      query.push(aql`FOR d IN ${collection} FILTER d.${identifier.property} == ${identifier.value}`)
    } else {
      query.push(aql`FOR d IN ${collection} FILTER d._key == ${identifier.value}`)
    }

    for (const link of dependencies) {
      query.push(literal(`LET ${link.edge}_keys = (FOR v, e, p IN 1..1 ANY d GRAPH ${link.graph} RETURN e._key)`))
      // query.push(aql` LET ${link.edge}_keys = (FOR v, e, p IN 1..1 ANY d GRAPH '${link.graph}' RETURN e._key)`)
    }

    for (const link of dependencies) {
      query.push(literal(`LET ${link.edge}_removed = (FOR key IN ${link.edge}_keys REMOVE key IN ${link.edge} RETURN { _id: OLD._id, _key: OLD._key, _rev: OLD._rev })`))
      // query.push(aql` LET ${link.edge}_removed = (FOR key IN ${link.edge}_keys REMOVE key IN ${link.edge})`)
    }

    query.push(literal(`REMOVE d IN ${collection.name}`))
    // query.push(aql` REMOVE d IN ${collection}`)

    query.push(literal('RETURN MERGE({ _id: OLD._id, _key: OLD._key, _rev: OLD._rev },'))
    // query.push(aql` RETURN { ${collection}: { _id: OLD._id, _key: OLD._key, _rev: OLD._rev },`)

    for (let i = 0; i < dependencies.length; i++) {
      if (i === dependencies.length - 1) {
        query.push(literal(`{ ${dependencies[i].edge}: ${dependencies[i].edge}_removed }`))
        // query.push(aql` ${dependencies[i].edge}: ${dependencies[i].edge}_keys`)
      } else {
        query.push(literal(`{ ${dependencies[i].edge}: ${dependencies[i].edge}_removed },`))
        // query.push(aql` ${dependencies[i].edge}: ${dependencies[i].edge}_keys,`)
      }
    }

    query.push(aql`)`)

    return join(query)
  }

  return aql`
      FOR d IN ${collection}
      FILTER d.${identifier.property} == ${identifier.value}
      REMOVE d IN ${collection}
      RETURN { _id: OLD._id, _key: OLD._key, _rev: OLD._rev }`
}

export function uniqueConstraintQuery(
  collection: DocumentCollection | EdgeCollection,
  constraints: UniqueConstraint,
  options?: FetchOptions
): AqlQuery {
  if (_debugFiltersEnabled(options)) {
    _debug.log.filters(constraints)
  } else {
    _debug.filters(constraints)
  }

  const filters: AqlValue[] = []

  if (constraints.composite) {
    let count = 0

    if (constraints.singular) {
      filters.push(literal(' ('))
    }

    for (const constraint of constraints.composite) {
      count++
      if (count > 1) {
        filters.push(literal(' &&'))
      }

      filters.push(_toPropertyFilter(constraint))
    }

    if (constraints.singular) {
      filters.push(literal(' ) ||'))
    }
  }

  if (constraints.singular) {
    const singular = Array.isArray(constraints.singular)
      ? constraints.singular
      : [constraints.singular]

    let count = 0

    for (const constraint of singular) {
      count++
      if (count > 1) {
        filters.push(literal(' ||'))
      }

      filters.push(_toPropertyFilter(constraint))
    }
  }

  const excl: AqlValue[] = []

  if (constraints.excludeDocumentKey) {
    excl.push(aql`d._key != ${constraints.excludeDocumentKey}`)
  }

  const query = excl.length > 0
    ? aql`FOR d IN ${collection} FILTER (${join(excl, '')}) FILTER (${join(filters, '')} ) RETURN d._key`
    : aql`FOR d IN ${collection} FILTER (${join(filters, '')} ) RETURN d._key`

  if (_debugFiltersEnabled(options) || _printQuery(options)) {
    _debug.log.queries(query)
  } else {
    _debug.queries(query)
  }

  return query
}

export function fetchRelations(fetch: GraphFetchInstruction, options?: any): string {
  const { strategy, direction, startFrom, usingGraph } = fetch

  const bound = (direction.toUpperCase() === 'IN' || direction.toUpperCase() === 'INBOUND')
    ? 'INBOUND'
    : 'OUTBOUND'

  const propNameVertex = fetch.vertexPropName ? fetch.vertexPropName : 'vertex'
  const propNameEdges = fetch.edgePropName ? fetch.edgePropName : 'edges'

  if (
    strategy === GraphFetchStrategy.DISTINCT_VERTEX_EDGE_TUPLES ||
    strategy === GraphFetchStrategy.DISTINCT_VERTEX_WITH_EDGES_MERGED
  ) {
    let query = 'LET ve = ('
    query += 'FOR v,e IN 1 ' + bound + ' "' + startFrom.collection + '/' + startFrom.key + '" GRAPH ' + usingGraph + ' FILTER v != null '
    // query += 'RETURN MERGE(e, { "_vertex": v._key })'
    query += 'RETURN e'
    query += ') ' // query += ') RETURN ve'

    query += 'LET distinctVsGroupedByE = ('
    query += 'FOR i IN ve COLLECT vertexId = i._to INTO edgesGrouped = i RETURN { "vertex": vertexId, "edges": edgesGrouped }'
    /// query += ') RETURN distinctVsGroupedByE'
    query += ') '

    if (strategy === GraphFetchStrategy.DISTINCT_VERTEX_EDGE_TUPLES) {
      query += 'FOR dve IN distinctVsGroupedByE LET d = DOCUMENT(dve.vertex) '
      query += 'RETURN { "' + propNameVertex + '": d, "' + propNameEdges + '": dve.edges}'
    } else if (strategy === GraphFetchStrategy.DISTINCT_VERTEX_WITH_EDGES_MERGED) {
      query += 'FOR dve IN distinctVsGroupedByE LET d = DOCUMENT(dve.vertex) '
      query += 'RETURN MERGE(d, { "' + propNameEdges + '": dve.edges})'
    }

    if (options?.printQuery) {
      console.log(query)
    }

    return query
  }

  if (strategy === GraphFetchStrategy.NON_DISTINCT_VERTEX_EDGE_TUPLES) {
    let query = 'FOR v,e IN 1 ' + bound + ' "' + startFrom.collection + '/' + startFrom.key + '" GRAPH ' + usingGraph + ' FILTER v != null '
    query += 'RETURN { "' + propNameVertex + '": v, "' + propNameEdges + '": e }'

    if (options?.printQuery) {
      console.log(query)
    }

    return query
  }

  if (strategy === GraphFetchStrategy.DISTINCT_VERTEX) {
    let query = 'FOR v IN 1 ' + bound + ' "' + startFrom.collection + '/' + startFrom.key + '" GRAPH ' + usingGraph + ' FILTER v != null '
    query += 'COLLECT vertexId = v._key INTO vertexGrouped = v RETURN FIRST(vertexGrouped)'

    if (options?.printQuery) {
      console.log(query)
    }

    return query
  }

  // strategy === GraphFetchStrategy.NON_DISTINCT_VERTEX}
  const query = 'FOR v IN 1 ' + bound + ' "' + startFrom.collection + '/' + startFrom.key + '" GRAPH ' + usingGraph + ' FILTER v != null RETURN v'

  if (options?.printQuery) {
    console.log(query)
  }

  return query
}

export const Queries = {
  fetchAll,
  fetchByCriteria,
  fetchByMatchingProperty,
  fetchByMatchingAnyProperty,
  fetchByMatchingAllProperties,
  uniqueConstraintQuery,
  updateDocumentsByKeyValue,
  deleteDocumentsByKeyValue,
  fetchRelations
}

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
  GraphFetchStrategy,
  EdgeDataScope,
  GraphFetchOptions,
  DocumentTrimOptions
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
function _toTrimmedDocStatement(trimOpts: DocumentTrimOptions, docVar?: string): AqlValue[] {
  const trim: AqlValue[] = []

  const d = docVar ?? 'd'

  if (trimOpts?.keep) {
    if (Array.isArray(trimOpts.keep)) {
      trim.push(literal(`KEEP(${d}, "${trimOpts.keep.join('", "')}")`))
    } else {
      trim.push(literal(`KEEP(${d}, "${trimOpts.keep}")`))
    }
  } else if (trimOpts?.omit) {
    if (Array.isArray(trimOpts.omit)) {
      trim.push(literal(`UNSET_RECURSIVE(${d}, "${trimOpts.omit.join('", "')}")`))
    } else {
      trim.push(literal(`UNSET_RECURSIVE(${d}, "${trimOpts.omit}")`))
    }
  } else {
    trim.push(literal(`${d}`))
  }

  return trim
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

// function reverseDirection(direction: string) {
//   if (direction === 'OUTBOUND') {
//     return 'INBOUND'
//   }

//   return 'OUTBOUND'
// }

export function fetchRelations(
  fetch: GraphFetchInstruction,
  options?: GraphFetchOptions
): AqlQuery {
  const { from, graph, direction } = fetch

  const bound = (direction.toUpperCase() === 'IN' || direction.toUpperCase() === 'INBOUND')
    ? 'INBOUND'
    : 'OUTBOUND'

  let propNameVertexTo: string = 'vertex'
  let propNameVertexFrom: string = 'vertex'
  let propNameEdges: string = 'edges'

  const parentVertex: string = 'ref'

  let vertexTrim
  let edgeTrim

  let strategy = GraphFetchStrategy.NON_DISTINCT_VERTEX
  let edgeDataScope = EdgeDataScope.NONE

  if (fetch?.strategy) {
    strategy = fetch.strategy
  }

  if (options?.strategy) {
    strategy = options.strategy
  }

  if (fetch?.edgeDataScope) {
    edgeDataScope = fetch.edgeDataScope
  }

  if (options?.edgeDataScope) {
    edgeDataScope = options.edgeDataScope
  }

  if (fetch?.vertexNameFrom) {
    propNameVertexFrom = fetch.vertexNameFrom
  }

  if (options?.vertexNameFrom) {
    propNameVertexFrom = options.vertexNameFrom
  }

  if (fetch?.vertexNameTo) {
    propNameVertexTo = fetch.vertexNameTo
  }

  if (options?.vertexNameTo) {
    propNameVertexTo = options.vertexNameTo
  }

  if (fetch?.edgeName) {
    propNameEdges = fetch.edgeName
  }

  if (options?.edgeName) {
    propNameEdges = options.edgeName
  }

  if (fetch?.vertexTrim) {
    vertexTrim = fetch.vertexTrim
  }

  if (options?.vertexTrim) {
    vertexTrim = options.vertexTrim
  }

  if (fetch?.edgeTrim) {
    edgeTrim = fetch.edgeTrim
  }

  if (options?.edgeTrim) {
    edgeTrim = options.edgeTrim
  }

  const dtrim = _toTrimmedDocStatement(vertexTrim)
  const vtrim = _toTrimmedDocStatement(vertexTrim, 'v')
  const etrim = _toTrimmedDocStatement(edgeTrim, 'e')

  const query: AqlValue[] = []

  if (
    strategy === GraphFetchStrategy.DISTINCT_VERTEX_EDGES_TUPLE ||
    strategy === GraphFetchStrategy.DISTINCT_VERTEX_EDGES_JOINED
  ) {
    query.push(literal('LET ve = ('))
    query.push(literal(`FOR v,e IN 1 ${bound} "${from.collection}/${from.key}" GRAPH ${graph} FILTER v != null`))
    // query += 'FOR v,e IN 1 ' + bound + ' "' + from.collection + '/' + from.key + '" GRAPH ' + graph + ' FILTER v != null '

    if (edgeDataScope === EdgeDataScope.NONE) {
      query.push(aql`RETURN ${join(etrim, '')}`)
    } else {
      let propNameEdgeData = bound === 'INBOUND' ? propNameVertexFrom : propNameVertexTo
      if (propNameEdgeData === 'vertex') {
        propNameEdgeData = parentVertex
      }

      const parentIdProp = bound === 'INBOUND' ? '_to' : '_from'

      if (edgeDataScope === EdgeDataScope.JOINED) {
        query.push(literal(`LET parentDoc = DOCUMENT(e.${parentIdProp}) `))
        // query.push(literal(`RETURN MERGE_RECURSIVE(e, { "${propNameEdgeData}": parentDoc }) `))
        query.push(aql`RETURN MERGE_RECURSIVE(${join(etrim, '')}, { ${propNameEdgeData}: parentDoc }) `)
      } else {
        query.push(aql`RETURN MERGE_RECURSIVE(e, UNSET(parentDoc, "_key", "_id", "_rev", "_from", "_to" ), `)
        query.push(literal(`{ "_${propNameEdgeData}._id": parentDoc._id, "_${propNameEdgeData}._key": parentDoc._key }) `))
      }
    }

    query.push(literal(') ')) // query += ') RETURN ve'

    const vertexIdField = bound === 'INBOUND' ? '_from' : '_to'

    query.push(literal('LET distinctVGroupedByE = ('))
    query.push(literal(`FOR e IN ve COLLECT vertexId = e.${vertexIdField} INTO edgesGrouped = e RETURN { "vertex": vertexId, "edges": edgesGrouped }`))
    /// query += ') RETURN distinctVGroupedByE'
    query.push(literal(') '))

    if (strategy === GraphFetchStrategy.DISTINCT_VERTEX_EDGES_TUPLE) {
      const propName = bound === 'INBOUND' ? propNameVertexTo : propNameVertexFrom
      query.push(literal('FOR dve IN distinctVGroupedByE '))
      query.push(literal('LET d = DOCUMENT(dve.vertex) '))
      // query.push(literal(`RETURN { "${propName}": d, "${propNameEdges}": dve.edges}`))
      query.push(aql`RETURN { ${propName}: ${join(dtrim, '')}, ${propNameEdges}: dve.edges}`)
    } else if (strategy === GraphFetchStrategy.DISTINCT_VERTEX_EDGES_JOINED) {
      query.push(literal('FOR dve IN distinctVGroupedByE '))
      query.push(literal('LET d = DOCUMENT(dve.vertex) '))
      // query.push(literal(`RETURN MERGE_RECURSIVE(d, { "${propNameEdges}": dve.edges})`))
      query.push(aql`RETURN MERGE_RECURSIVE(${join(dtrim, '')}, { ${propNameEdges}: dve.edges})`)
    }
  } else {
    query.push(literal(`FOR v,e IN 1 ${bound} "${from.collection}/${from.key}" GRAPH ${graph} FILTER v != null `))

    if (strategy === GraphFetchStrategy.NON_DISTINCT_VERTEX_EDGE_TUPLE) {
      // query.push(literal(`RETURN { "${propNameVertexTo}": v, "' + propNameEdges + '": e }`))
      query.push(aql`RETURN { ${propNameVertexTo}: ${join(vtrim, '')}, ${propNameEdges}: ${join(etrim, '')} }`)
    }

    if (strategy === GraphFetchStrategy.DISTINCT_VERTEX) {
      // WK test this in both directions - similar to vertexIdField above?
      // query.push(literal('COLLECT vertexId = v._key INTO vertexGrouped = v RETURN FIRST(vertexGrouped)'))
      query.push(literal('COLLECT vertexId = v._key INTO vertexGrouped = v'))
      query.push(literal('LET d = FIRST(vertexGrouped)'))
      query.push(aql`RETURN ${join(dtrim, '')}`)
    }

    if (strategy === GraphFetchStrategy.NON_DISTINCT_VERTEX) {
      // query.push(literal('RETURN v'))
      query.push(aql`RETURN ${join(vtrim, '')}`)
    }
  }

  const q = join(query)

  if (_debugFiltersEnabled(options) || _printQuery(options)) {
    _debug.log.queries(q)
  } else {
    _debug.queries(q)
  }

  return q

  // const opts = _toQueryOpts(options)

  // const q = opts && opts.length > 0
  //   ? aql`FOR d IN ${collection} ${join(opts, '')} RETURN ${join(trim, '')}`
  //   : aql`FOR d IN ${collection} RETURN ${join(trim, '')}`

  // return q
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

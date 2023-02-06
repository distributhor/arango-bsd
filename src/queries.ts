/* eslint-disable no-prototype-builtins */
import { aql, AqlQuery } from 'arangojs/aql'
import { DocumentCollection } from 'arangojs/collection'
import {
  UniqueConstraint,
  isCompositeKey,
  isUniqueValue,
  NamedValue,
  SortOptions,
  IndexedValue,
  ListOfFilters,
  MatchTypeOperator,
  MatchType,
  FilterOptions
} from './index'

/** @internal */
export function isListOfFilters(x: any): x is ListOfFilters {
  return x.filters
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

/** @internal */
function _fetchByKeyValue(
  collection: string,
  identifier: NamedValue | NamedValue[],
  options: SortOptions,
  keyValueMatchType: MatchType
): AqlQuery {
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

      const keyParam = `${kv.name}_key_${keyCount}`
      const valueParam = `${kv.name}_val_${keyCount}`

      params[keyParam] = kv.name
      params[valueParam] = kv.value

      query += ` d.@${keyParam} == @${valueParam}`
    }

    // query += " )";
  } else {
    params.property = identifier.name
    params.value = identifier.value
    query += '  d.@property == @value'
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

  // if (this._hasKeepOption(options)) {
  //   query += " RETURN KEEP( d, [" + this._getKeepInstruction(options) + "])";
  // } else if (this._hasOmitOption(options)) {
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

export function fetchByPropertyValue(
  collection: string,
  identifier: NamedValue | NamedValue[],
  options: SortOptions = {}
): AqlQuery {
  return _fetchByKeyValue(collection, identifier, options, MatchType.ANY)
}

export function fetchByCompositeValue(
  collection: string,
  identifier: NamedValue[],
  options: SortOptions = {}
): AqlQuery {
  return _fetchByKeyValue(collection, identifier, options, MatchType.ALL)
}

export function findByFilterCriteria(
  collection: string,
  filter: string | ListOfFilters,
  options: FilterOptions = {}
): AqlQuery {
  // if (options.hasOwnProperty("returnDataFieldName")) {
  //   queryOptions.returnDataFieldName = options.returnDataFieldName;
  // }

  const params: any = {}
  let query = 'FOR d IN ' + collection

  if (options.restrictTo) {
    params.restrictTo = options.restrictTo
    query += ' FILTER d.@restrictTo'
  }

  if (filter?.match) {
    if (isListOfFilters(filter)) {
      query += ' FILTER ( '

      for (let i = 0; i < filter.filters.length; i++) {
        if (i > 0) {
          query += ` ${MatchTypeOperator[filter.match]} `
        }
        if (options.prefixPropertyNames) {
          query += _prefixPropertNameInFilterToken(filter.filters[i])
        } else {
          query += filter.filters[i]
        }
      }

      query += ' )'
    } else {
      if (options.prefixPropertyNames) {
        query += ' FILTER ( ' + _prefixPropertyNames(filter) + ' )'
      } else {
        query += ' FILTER ( ' + filter + ' )'
      }
    }
  }

  // TODO: Support sorting by multiple criteria ...
  // SORT u.lastName, u.firstName, u.id DESC
  /*
  if (options.hasOwnProperty("sortBy")) {
    query += " SORT d." + options.sortBy;
    resultMeta.sortBy = options.sortBy;

    if (options.hasOwnProperty("sortDirection")) {
      if (options.sortDirection === "ascending") {
        query += " ASC";
      } else if (options.sortDirection === "descending") {
        query += " DESC";
      }
      resultMeta.sortDirection = options.sortDirection;
    }

    if (options.hasOwnProperty("sortOrder")) {
      if (options.sortOrder === "ascending") {
        query += " ASC";
      } else if (options.sortOrder === "descending") {
        query += " DESC";
      }
      resultMeta.sortOrder = options.sortOrder;
    }
  }

  if (options.hasOwnProperty("limit") && options.limit > 0) {
    resultMeta.limit = options.limit;
    if (options.hasOwnProperty("fullCount") && options.fullCount) {
      queryOptions.count = false;
      queryOptions.options = { fullCount: true };
    }
    if (options.hasOwnProperty("offset")) {
      resultMeta.offset = options.offset;
      query += " LIMIT " + options.offset + ", " + options.limit;
    } else {
      resultMeta.offset = 0;
      query += " LIMIT " + options.limit;
    }
  }

  if (this._hasOmitOption(options)) {
    query += " RETURN UNSET_RECURSIVE( d, [" + this._getOmitInstruction(options) + "])";
  } else {
    query += " RETURN d";
  }
  */
  query += ' RETURN d'

  return {
    query,
    bindVars: params
  }
}

export function updateDocumentsByKeyValue(collection: DocumentCollection, identifier: NamedValue, data: any): AqlQuery {
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

export function deleteDocumentsByKeyValue(collection: DocumentCollection, identifier: NamedValue): AqlQuery {
  // return literal(
  //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" REMOVE d IN ${collection} RETURN { _key: d._key, _id: d._id, _rev: d._rev }`
  // )

  return aql`
    FOR d IN ${collection}
    FILTER d.${identifier.name} == ${identifier.value}
    REMOVE d IN ${collection}
    RETURN { _key: d._key }`
}

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
      let keyCount = 0

      query += ' ('

      for (const kv of constraint.composite) {
        keyCount++

        if (keyCount > 1) {
          query += ' &&'
        }

        const keyParam = `${kv.name}_key_${keyCount}`
        const valueParam = `${kv.name}_val_${keyCount}`

        params[keyParam] = kv.name
        params[valueParam] = kv.value

        query += ` d.@${keyParam} == @${valueParam}`
      }

      query += ' )'
    }

    if (isUniqueValue(constraint)) {
      const keyParam = `${constraint.unique.name}_key`
      const valueParam = `${constraint.unique.name}_val`

      params[keyParam] = constraint.unique.name
      params[valueParam] = constraint.unique.value

      query += ` d.@${keyParam} == @${valueParam}`
    }
  }

  query += ' RETURN d._key'

  return {
    query,
    bindVars: params
  }
}

export const Queries = {
  fetchByPropertyValue,
  fetchByCompositeValue,
  findByFilterCriteria,
  updateDocumentsByKeyValue,
  deleteDocumentsByKeyValue,
  uniqueConstraintQuery
}

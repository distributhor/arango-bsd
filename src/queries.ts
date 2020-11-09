/* eslint-disable no-prototype-builtins */
import { aql, AqlLiteral, AqlQuery } from "arangojs/aql";
import {
  UniqueConstraint,
  isCompositeKey,
  isUniqueValue,
  QueryType,
  KeyValue,
  SortOptions,
  LogicalOperatorSign,
  LogicalOperator,
  IndexValue,
} from "./index";

/** @internal */
export function _findAllIndicesOfSubString(
  subString: string | string[],
  targetString: string,
  caseInSensitive = true
): IndexValue[] {
  if (Array.isArray(subString)) {
    let indices: IndexValue[] = [];

    for (const s of subString) {
      indices = indices.concat(_findAllIndicesOfSubString(s, targetString, caseInSensitive));
    }

    return indices.sort(function (a: any, b: any) {
      return a.index > b.index ? 1 : -1;
    });
  }

  if (targetString.length == 0) {
    return [];
  }

  if (caseInSensitive) {
    targetString = targetString.toLowerCase();
    subString = subString.toLowerCase();
  }

  const indices: IndexValue[] = [];

  let index = targetString.indexOf(subString);
  while (index != -1) {
    indices.push({ index, value: subString });
    index = targetString.indexOf(subString, index + 1);
  }

  return indices;
}

/** @internal */
export function _replacePropertNameTokens(filterString: string): string {
  if (filterString.indexOf("(") > -1) {
    const tmp = filterString.replace(/\(\s*/, "(d.");
    return tmp.replace(/\s*\)/g, ")");
  }

  if (filterString.indexOf(")") > -1) {
    return "d." + filterString.replace(/\s*\)/, ")");
  }

  return "d." + filterString;
}

/** @internal */
export function _prefixPropertyNames(filterString: string): string {
  const validLogicalOperators = ["||", "&&"];
  // const validComparisonOperators = ["==", "!="];

  const logicalOperatorIndices = _findAllIndicesOfSubString(validLogicalOperators, filterString);

  if (logicalOperatorIndices.length === 0) {
    // const idx = _findAllIndicesOfSubString(validComparisonOperators, filterString);
    // console.log(idx[0]);
    // const leftOperand = filterString.substring(0, idx[0].index);
    // const rightOperand = filterString.substring(idx[0].index + idx[0].value.length);
    // console.log(`${leftOperand}  ${idx[0].value}  ${rightOperand}`);
    return _replacePropertNameTokens(filterString);
  }

  let modifiedFilter = "";
  let stringIndex = 0;

  for (let i = 0; i <= logicalOperatorIndices.length; i++) {
    // The <= is intentional. We need to add one iteration beyond the number of operators,
    // so that the last filter expression can be included in the string build
    let partialFilterString = undefined;
    let logicalOperator = undefined;

    if (i === logicalOperatorIndices.length) {
      partialFilterString = filterString.substring(stringIndex).trim();
    } else {
      partialFilterString = filterString.substring(stringIndex, logicalOperatorIndices[i].index).trim();
      logicalOperator = filterString.substring(
        logicalOperatorIndices[i].index,
        logicalOperatorIndices[i].index + logicalOperatorIndices[i].value.length
      );
      stringIndex = logicalOperatorIndices[i].index + logicalOperatorIndices[i].value.length;
    }

    modifiedFilter += _replacePropertNameTokens(partialFilterString);

    if (logicalOperator) {
      modifiedFilter += " " + logicalOperator + " ";
    }
  }

  return modifiedFilter;
}

/** @internal */
function _fetchByKeyValue(
  collection: string,
  identifier: KeyValue | KeyValue[],
  options: SortOptions,
  queryType: QueryType,
  keyValueCombinator: LogicalOperator
): string | AqlQuery {
  const params: any = {};
  let query = `FOR d IN ${collection} FILTER`;

  if (Array.isArray(identifier)) {
    let keyCount = 0;

    // query += " (";

    for (const kv of identifier) {
      keyCount++;

      if (keyCount > 1) {
        query += ` ${LogicalOperatorSign[keyValueCombinator]}`;
      }

      if (queryType === QueryType.STRING) {
        if (typeof kv.value === "number") {
          query += ` d.${kv.key} == ${kv.value}`;
        } else {
          query += ` d.${kv.key} == "${kv.value}"`;
        }
      } else {
        const keyParam = `${kv.key}_key_${keyCount}`;
        const valueParam = `${kv.key}_val_${keyCount}`;

        params[keyParam] = kv.key;
        params[valueParam] = kv.value;

        query += ` d.@${keyParam} == @${valueParam}`;
      }
    }

    // query += " )";
  } else {
    if (queryType === QueryType.STRING) {
      if (typeof identifier.value === "number") {
        query += ` d.${identifier.key} == ${identifier.value}`;
      } else {
        query += ` d.${identifier.key} == "${identifier.value}"`;
      }
    } else {
      params["property"] = identifier.key;
      params["value"] = identifier.value;
      query += `  d.@property == @value`;
    }
  }

  if (options && options.hasOwnProperty("sortBy")) {
    query += ` SORT d.${options.sortBy}`;

    if (options.hasOwnProperty("sortOrder")) {
      if (options.sortOrder === "ascending") {
        query += " ASC";
      } else if (options.sortOrder === "descending") {
        query += " DESC";
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

  query += " RETURN d";

  if (queryType === QueryType.STRING) {
    return query;
  } else {
    return {
      query,
      bindVars: params,
    };
  }
}

export function fetchByKeyValue(
  collection: string,
  identifier: KeyValue | KeyValue[],
  options: SortOptions = {},
  queryType: QueryType = QueryType.AQL
): string | AqlQuery {
  return _fetchByKeyValue(collection, identifier, options, queryType, LogicalOperator.OR);
}

export function fetchByCompositeKeyValue(
  collection: string,
  identifier: KeyValue[],
  options: SortOptions = {},
  queryType: QueryType = QueryType.AQL
): string | AqlQuery {
  return _fetchByKeyValue(collection, identifier, options, queryType, LogicalOperator.AND);
}

export function findByFilterCriteria(
  collection: string,
  filters: string | string[],
  filterCombinator?: LogicalOperator,
  options: any = {}
): string | AqlLiteral {
  // let resultMeta = {};
  // let queryOptions = {};

  // if (options.hasOwnProperty("returnDataFieldName")) {
  //   queryOptions.returnDataFieldName = options.returnDataFieldName;
  // }

  let query = "FOR d IN " + collection;

  if (options.hasOwnProperty("restrictTo")) {
    query += " FILTER d." + options.restrictTo;
  }

  if (filters) {
    if (Array.isArray(filters) && filters.length > 0) {
      query += " FILTER ( ";

      for (let i = 0; i < filters.length; i++) {
        if (i > 0) {
          query += " " + LogicalOperatorSign[filterCombinator] + " ";
        }
        query += _replacePropertNameTokens(filters[i]);
      }

      query += " )";
    } else {
      query += " FILTER ( " + this._prefixPropertyNames(filters) + " )";
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

  return aql.literal(query);
}

export function updateDocumentsByKeyValue(collection: string, identifier: KeyValue, data: any): AqlLiteral {
  return aql.literal(
    `FOR d IN ${collection} FILTER d.${identifier.key} == "${identifier.value}" UPDATE d WITH ${JSON.stringify(
      data
    )} IN ${collection} RETURN { _key: NEW._key, _id: NEW._id, _rev: NEW._rev, _oldRev: OLD._rev }`
  );
}

export function deleteDocumentsByKeyValue(collection: string, identifier: KeyValue): AqlLiteral {
  return aql.literal(
    `FOR d IN ${collection} FILTER d.${identifier.key} == "${identifier.value}" REMOVE d IN ${collection} RETURN { _key: d._key, _id: d._id, _rev: d._rev }`
  );
}

export function uniqueConstraintQuery(
  constraints: UniqueConstraint,
  queryType: QueryType = QueryType.AQL
): string | AqlQuery {
  if (!constraints || constraints.constraints.length === 0) {
    return;
  }

  const params: any = {};
  let query = `FOR d IN ${constraints.collection} FILTER`;

  if (constraints.excludeDocumentKey) {
    if (queryType === QueryType.STRING) {
      query += ` d._key != "${constraints.excludeDocumentKey}" FILTER`;
    } else {
      params["excludeDocumentKey"] = constraints.excludeDocumentKey;
      query += ` d._key != @excludeDocumentKey FILTER`;
    }
  }

  let constraintCount = 0;

  for (const constraint of constraints.constraints) {
    constraintCount++;

    if (constraintCount > 1) {
      query += " ||";
    }

    if (isCompositeKey(constraint)) {
      let keyCount = 0;

      query += " (";

      for (const kv of constraint.composite) {
        keyCount++;

        if (keyCount > 1) {
          query += " &&";
        }

        if (queryType === QueryType.STRING) {
          query += ` d.${kv.key} == "${kv.value}"`;
        } else {
          const keyParam = `${kv.key}_key_${keyCount}`;
          const valueParam = `${kv.key}_val_${keyCount}`;

          params[keyParam] = kv.key;
          params[valueParam] = kv.value;

          query += ` d.@${keyParam} == @${valueParam}`;
        }
      }

      query += " )";
    }

    if (isUniqueValue(constraint)) {
      if (queryType === QueryType.STRING) {
        query += ` d.${constraint.unique.key} == "${constraint.unique.value}"`;
      } else {
        const keyParam = `${constraint.unique.key}_key`;
        const valueParam = `${constraint.unique.key}_val`;

        params[keyParam] = constraint.unique.key;
        params[valueParam] = constraint.unique.value;

        query += ` d.@${keyParam} == @${valueParam}`;
      }
    }
  }

  query += " RETURN d._key";

  if (queryType === QueryType.STRING) {
    return query;
  } else {
    return {
      query,
      bindVars: params,
    };
  }
}

export const Queries = {
  fetchByCompositeKeyValue,
  fetchByKeyValue,
  updateDocumentsByKeyValue,
  deleteDocumentsByKeyValue,
  uniqueConstraintQuery,
};

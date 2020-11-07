/* eslint-disable no-prototype-builtins */
import { aql, AqlQuery } from "arangojs/aql";
import { UniqueConstraint, isCompositeKey, isUniqueValue, QueryType, KeyValue, SortOptions } from "./index";

export function fetchDocumentByKeyValue(
  collection: string,
  identifier: KeyValue | KeyValue[],
  options: SortOptions = {},
  queryType: QueryType = QueryType.AQL
): AqlQuery {
  const params: any = {};
  let query = `FOR d IN ${collection} FILTER`;

  if (Array.isArray(identifier)) {
    let keyCount = 0;

    query += " (";

    for (const kv of identifier) {
      keyCount++;

      if (keyCount > 1) {
        query += " &&";
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

    query += " )";
  } else {
    if (queryType === QueryType.STRING) {
      query += ` d.${identifier.key} == "${identifier.value}"`;
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

  return {
    query,
    bindVars: params,
  };
}

export function updateDocumentByKeyValue(collection: string, identifier: KeyValue, data: any): AqlQuery {
  return aql`FOR d IN ${collection} FILTER d.${identifier.key} == "${identifier.value}" UPDATE u WITH ${JSON.stringify(
    data
  )} IN ${collection}`;
}

export function deleteDocumentByKeyValue(collection: string, identifier: KeyValue): AqlQuery {
  return aql`FOR d IN ${collection} FILTER d.${identifier.key} == "${identifier.value}" REMOVE u IN ${collection}`;
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
  fetchDocumentByKeyValue,
  updateDocumentByKeyValue,
  deleteDocumentByKeyValue,
  uniqueConstraintQuery,
};

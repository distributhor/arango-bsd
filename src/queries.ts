import { AqlQuery } from "arangojs/aql";
import { UniqueConstraint, isCompositeKey, isUniqueValue, QueryType } from "./index";

export function toConstraintValidationQuery(
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCompositeKey = exports.isUniqueValue = exports.isGraphDefinitionArray = exports.isGraphDefinition = exports.MatchTypeOperator = exports.MatchType = exports.QueryReturnType = void 0;
var QueryReturnType;
(function (QueryReturnType) {
    QueryReturnType["DOCUMENTS"] = "documents";
    QueryReturnType["CURSOR"] = "cursor";
})(QueryReturnType = exports.QueryReturnType || (exports.QueryReturnType = {}));
var MatchType;
(function (MatchType) {
    MatchType["ANY"] = "ANY";
    MatchType["ALL"] = "ALL";
})(MatchType = exports.MatchType || (exports.MatchType = {}));
var MatchTypeOperator;
(function (MatchTypeOperator) {
    MatchTypeOperator["ANY"] = "||";
    MatchTypeOperator["ALL"] = "&&";
})(MatchTypeOperator = exports.MatchTypeOperator || (exports.MatchTypeOperator = {}));
/** @internal */
function isGraphDefinition(x) {
    return x.graph;
}
exports.isGraphDefinition = isGraphDefinition;
/** @internal */
function isGraphDefinitionArray(x) {
    return x.length > 0 && isGraphDefinition(x[0]);
}
exports.isGraphDefinitionArray = isGraphDefinitionArray;
/** @internal */
function isUniqueValue(x) {
    return x.unique;
}
exports.isUniqueValue = isUniqueValue;
/** @internal */
function isCompositeKey(x) {
    return x.composite;
}
exports.isCompositeKey = isCompositeKey;
/*
export enum NegationOperator {
  NOT = "NOT",
}

export enum LogicalOperator {
  AND = "AND",
  OR = "OR",
}

export const LogicalOperatorSign = {
  AND: "&&",
  OR: "||",
  and: "&&",
  or: "||",
};

export enum ComparisonOperator {
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  LESS = "LESS",
  GREATER = "GREATER",
  LESS_OR_EQUAL = "LESS_OR_EQUAL",
  GREATER_OR_EQUAL = "GREATER_OR_EQUAL",
  IN = "IN",
  NOT_IN = "NOT_IN",
  LIKE = "LIKE",
  NOT_LIKE = "NOT_LIKE",
  REGEX = "REGEX",
  NOT_REGEX = "NOT_REGEX",
  EMPTY = "EMPTY",
  NOT_EMPTY = "NOT_EMPTY",
}

export const ComparisonOperatorSign = {
  EQUAL: "==",
  NOT_EQUAL: "!=",
  EMPTY: "EMPTY",
  NOT_EMPTY: "NOT_EMPTY",
  LIKE: "LIKE",
};
*/
//# sourceMappingURL=types.js.map
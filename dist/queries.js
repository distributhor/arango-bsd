"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queries = exports.uniqueConstraintQuery = exports.deleteDocumentsByKeyValue = exports.updateDocumentsByKeyValue = exports.findByFilterCriteria = exports.fetchByCompositeValue = exports.fetchByPropertyValue = exports._prefixPropertyNames = exports._prefixPropertNameInFilterToken = exports._findAllIndicesOfSubString = exports.isListOfFilters = void 0;
/* eslint-disable no-prototype-builtins */
const aql_1 = require("arangojs/aql");
const index_1 = require("./index");
/** @internal */
function isListOfFilters(x) {
    return x.filters;
}
exports.isListOfFilters = isListOfFilters;
/** @internal */
function _findAllIndicesOfSubString(subString, targetString, caseInSensitive = true) {
    if (Array.isArray(subString)) {
        let indices = [];
        for (const s of subString) {
            indices = indices.concat(_findAllIndicesOfSubString(s, targetString, caseInSensitive));
        }
        return indices.sort(function (a, b) {
            return a.index > b.index ? 1 : -1;
        });
    }
    if (targetString.length === 0) {
        return [];
    }
    if (caseInSensitive) {
        targetString = targetString.toLowerCase();
        subString = subString.toLowerCase();
    }
    const indices = [];
    let index = targetString.indexOf(subString);
    while (index !== -1) {
        indices.push({ index, value: subString });
        index = targetString.indexOf(subString, index + 1);
    }
    return indices;
}
exports._findAllIndicesOfSubString = _findAllIndicesOfSubString;
/** @internal */
function _prefixPropertNameInFilterToken(filterStringToken) {
    if (filterStringToken.includes('(')) {
        const tmp = filterStringToken.replace(/\(\s*/, '(d.');
        return tmp.replace(/\s*\)/g, ')');
    }
    if (filterStringToken.includes(')')) {
        return 'd.' + filterStringToken.replace(/\s*\)/, ')');
    }
    return 'd.' + filterStringToken;
}
exports._prefixPropertNameInFilterToken = _prefixPropertNameInFilterToken;
/** @internal */
function _prefixPropertyNames(filterString) {
    // split filter string into tokens, delimited by logical operators,
    // so that the lefthand operands (the variables) can be prefixed with d.
    // const validLogicalOperators = ["||", "&&", "AND", "OR"];
    const validLogicalOperators = ['||', '&&'];
    const logicalOperatorIndices = _findAllIndicesOfSubString(validLogicalOperators, filterString);
    if (logicalOperatorIndices.length === 0) {
        return _prefixPropertNameInFilterToken(filterString);
    }
    let modifiedFilter = '';
    let stringIndex = 0;
    for (let i = 0; i <= logicalOperatorIndices.length; i++) {
        // The <= is intentional. We need to add one iteration beyond the number of operators,
        // so that the last filter expression can be included in the string build
        let partialFilterString;
        let logicalOperator;
        if (i === logicalOperatorIndices.length) {
            partialFilterString = filterString.substring(stringIndex).trim();
        }
        else {
            partialFilterString = filterString.substring(stringIndex, logicalOperatorIndices[i].index).trim();
            logicalOperator = filterString.substring(logicalOperatorIndices[i].index, logicalOperatorIndices[i].index + logicalOperatorIndices[i].value.length);
            stringIndex = logicalOperatorIndices[i].index + logicalOperatorIndices[i].value.length;
        }
        modifiedFilter += _prefixPropertNameInFilterToken(partialFilterString);
        if (logicalOperator) {
            modifiedFilter += ' ' + logicalOperator + ' ';
        }
    }
    return modifiedFilter;
}
exports._prefixPropertyNames = _prefixPropertyNames;
/** @internal */
function _fetchByKeyValue(collection, identifier, options, keyValueMatchType) {
    const params = {};
    let query = `FOR d IN ${collection} FILTER`;
    if (Array.isArray(identifier)) {
        let keyCount = 0;
        // query += " (";
        for (const kv of identifier) {
            keyCount++;
            if (keyCount > 1) {
                query += ` ${index_1.MatchTypeOperator[keyValueMatchType]}`;
            }
            const keyParam = `${kv.name}_key_${keyCount}`;
            const valueParam = `${kv.name}_val_${keyCount}`;
            params[keyParam] = kv.name;
            params[valueParam] = kv.value;
            query += ` d.@${keyParam} == @${valueParam}`;
        }
        // query += " )";
    }
    else {
        params.property = identifier.name;
        params.value = identifier.value;
        query += '  d.@property == @value';
    }
    if (options === null || options === void 0 ? void 0 : options.hasOwnProperty('sortBy')) {
        query += ` SORT d.${options.sortBy}`;
        if (options.hasOwnProperty('sortOrder')) {
            if (options.sortOrder === 'ascending') {
                query += ' ASC';
            }
            else if (options.sortOrder === 'descending') {
                query += ' DESC';
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
    query += ' RETURN d';
    return {
        query,
        bindVars: params
    };
}
function fetchByPropertyValue(collection, identifier, options = {}) {
    return _fetchByKeyValue(collection, identifier, options, index_1.MatchType.ANY);
}
exports.fetchByPropertyValue = fetchByPropertyValue;
function fetchByCompositeValue(collection, identifier, options = {}) {
    return _fetchByKeyValue(collection, identifier, options, index_1.MatchType.ALL);
}
exports.fetchByCompositeValue = fetchByCompositeValue;
function findByFilterCriteria(collection, filter, options = {}) {
    // if (options.hasOwnProperty("returnDataFieldName")) {
    //   queryOptions.returnDataFieldName = options.returnDataFieldName;
    // }
    const prefixPropertyNames = true; // options.prefixPropertyNames
    const params = {};
    let query = 'FOR d IN ' + collection;
    // TODO: enable and document this ??
    // if (options.restrictTo) {
    //   params.restrictTo = options.restrictTo
    //   query += ' FILTER d.@restrictTo'
    // }
    if (filter === null || filter === void 0 ? void 0 : filter.match) {
        if (isListOfFilters(filter)) {
            query += ' FILTER ( ';
            for (let i = 0; i < filter.filters.length; i++) {
                if (i > 0) {
                    query += ` ${index_1.MatchTypeOperator[filter.match]} `;
                }
                if (prefixPropertyNames) {
                    query += _prefixPropertNameInFilterToken(filter.filters[i]);
                }
                else {
                    query += filter.filters[i];
                }
            }
            query += ' )';
        }
        else {
            if (prefixPropertyNames) {
                query += ' FILTER ( ' + _prefixPropertyNames(filter) + ' )';
            }
            else {
                query += ' FILTER ( ' + filter + ' )';
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
    query += ' RETURN d';
    return {
        query,
        bindVars: params
    };
}
exports.findByFilterCriteria = findByFilterCriteria;
function updateDocumentsByKeyValue(collection, identifier, data) {
    // return literal(
    //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" UPDATE d WITH ${JSON.stringify(
    //     data
    //   )} IN ${collection} RETURN { _key: NEW._key, _id: NEW._id, _rev: NEW._rev, _oldRev: OLD._rev }`
    // )
    return (0, aql_1.aql) `
    FOR d IN ${collection}
    FILTER d.${identifier.name} == ${identifier.value}
    UPDATE d WITH ${data} IN ${collection}
    RETURN { _key: NEW._key }`;
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
exports.updateDocumentsByKeyValue = updateDocumentsByKeyValue;
function deleteDocumentsByKeyValue(collection, identifier) {
    // return literal(
    //   `FOR d IN ${collection} FILTER d.${identifier.property} == "${identifier.value}" REMOVE d IN ${collection} RETURN { _key: d._key, _id: d._id, _rev: d._rev }`
    // )
    return (0, aql_1.aql) `
    FOR d IN ${collection}
    FILTER d.${identifier.name} == ${identifier.value}
    REMOVE d IN ${collection}
    RETURN { _key: d._key }`;
}
exports.deleteDocumentsByKeyValue = deleteDocumentsByKeyValue;
function uniqueConstraintQuery(constraints) {
    if (!constraints || constraints.constraints.length === 0) {
        throw new Error('No constraints specified');
    }
    const params = {};
    let query = `FOR d IN ${constraints.collection} FILTER`;
    if (constraints.excludeDocumentKey) {
        params.excludeDocumentKey = constraints.excludeDocumentKey;
        query += ' d._key != @excludeDocumentKey FILTER';
    }
    let constraintCount = 0;
    for (const constraint of constraints.constraints) {
        constraintCount++;
        if (constraintCount > 1) {
            query += ' ||';
        }
        if ((0, index_1.isCompositeKey)(constraint)) {
            let keyCount = 0;
            query += ' (';
            for (const kv of constraint.composite) {
                keyCount++;
                if (keyCount > 1) {
                    query += ' &&';
                }
                const keyParam = `${kv.name}_key_${keyCount}`;
                const valueParam = `${kv.name}_val_${keyCount}`;
                params[keyParam] = kv.name;
                params[valueParam] = kv.value;
                query += ` d.@${keyParam} == @${valueParam}`;
            }
            query += ' )';
        }
        if ((0, index_1.isUniqueValue)(constraint)) {
            const keyParam = `${constraint.unique.name}_key`;
            const valueParam = `${constraint.unique.name}_val`;
            params[keyParam] = constraint.unique.name;
            params[valueParam] = constraint.unique.value;
            query += ` d.@${keyParam} == @${valueParam}`;
        }
    }
    query += ' RETURN d._key';
    return {
        query,
        bindVars: params
    };
}
exports.uniqueConstraintQuery = uniqueConstraintQuery;
exports.Queries = {
    fetchByPropertyValue,
    fetchByCompositeValue,
    findByFilterCriteria,
    updateDocumentsByKeyValue,
    deleteDocumentsByKeyValue,
    uniqueConstraintQuery
};
//# sourceMappingURL=queries.js.map
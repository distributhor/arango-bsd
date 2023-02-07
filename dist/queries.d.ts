import { AqlQuery } from 'arangojs/aql';
import { DocumentCollection } from 'arangojs/collection';
import { UniqueConstraint, NamedValue, SortOptions, IndexedValue, ListOfFilters, FetchOptions } from './index';
/** @internal */
export declare function isListOfFilters(x: any): x is ListOfFilters;
/** @internal */
export declare function _findAllIndicesOfSubString(subString: string | string[], targetString: string, caseInSensitive?: boolean): IndexedValue[];
/** @internal */
export declare function _prefixPropertNameInFilterToken(filterStringToken: string): string;
/** @internal */
export declare function _prefixPropertyNames(filterString: string): string;
export declare function fetchByPropertyValue(collection: string, identifier: NamedValue | NamedValue[], options?: SortOptions): AqlQuery;
export declare function fetchByCompositeValue(collection: string, identifier: NamedValue[], options?: SortOptions): AqlQuery;
export declare function findByFilterCriteria(collection: string, filter: string | ListOfFilters, options?: FetchOptions): AqlQuery;
export declare function updateDocumentsByKeyValue(collection: DocumentCollection, identifier: NamedValue, data: any): AqlQuery;
export declare function deleteDocumentsByKeyValue(collection: DocumentCollection, identifier: NamedValue): AqlQuery;
export declare function uniqueConstraintQuery(constraints: UniqueConstraint): AqlQuery;
export declare const Queries: {
    fetchByPropertyValue: typeof fetchByPropertyValue;
    fetchByCompositeValue: typeof fetchByCompositeValue;
    findByFilterCriteria: typeof findByFilterCriteria;
    updateDocumentsByKeyValue: typeof updateDocumentsByKeyValue;
    deleteDocumentsByKeyValue: typeof deleteDocumentsByKeyValue;
    uniqueConstraintQuery: typeof uniqueConstraintQuery;
};
//# sourceMappingURL=queries.d.ts.map
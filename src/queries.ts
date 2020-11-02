import { aql } from "arangojs";
import { GeneratedAqlQuery } from "arangojs/lib/cjs/aql-query";

export const fetchUserByName = (name: string): GeneratedAqlQuery => {
  return aql`
    FOR d IN user FILTER d.name LIKE ${name} RETURN d 
  `;
};

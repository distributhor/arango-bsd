import { aql, GeneratedAqlQuery } from "arangojs/aql";

export const fetchUserByName = (name: string): GeneratedAqlQuery => {
  return aql`
    FOR d IN user FILTER d.name LIKE ${name} RETURN d 
  `;
};

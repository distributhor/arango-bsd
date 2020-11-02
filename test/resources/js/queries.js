const { aql } = require("arangojs/aql");

exports.fetchUserByName = (name) => {
  return aql`
    FOR d IN user FILTER d.name LIKE ${name} RETURN d 
  `;
};

//
// Run with: node test/scripts/js/test.js
//
const { aql } = require("arangojs/aql");
const { ArangoDB } = require("../../../lib/index");

const fetchUserByName = (name) => {
  return aql`
    FOR d IN user FILTER d.name LIKE ${name} RETURN d 
  `;
};

(async function () {
  try {
    const db = new ArangoDB({
      databaseName: "arango-driver-test",
      url: "http://root:lol@db.localhost:8530",
    });

    const johnByQuery = await db.queryOne(fetchUserByName("John"));
    const johnByKey = await db.driver.collection("user").document(johnByQuery._key);

    console.log(johnByQuery);
    console.log(johnByKey);
  } catch (err) {
    console.log(err);
  }
})();

//
// Run with: node test/scripts/js/test.js
//
const { ArangoDB } = require("../../../lib/index");
const { fetchUserByName } = require("../../resources/js/queries");

(async function () {
  try {
    const db = new ArangoDB({
      databaseName: "arango-bsd-test",
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

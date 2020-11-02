import { ArangoDB } from "../src/db";
import { fetchUserByName } from "../src/queries";

(async function () {
  try {
    const db = new ArangoDB({
      databaseName: "arango-bsd-test",
      url: "http://root:letmein@db.localhost:8530",
    });

    const johnByQuery = await db.queryOne(fetchUserByName("John"));
    const johnByKey = await db.driver.collection("user").document(johnByQuery._key);

    console.log(johnByQuery);
    console.log(johnByKey);
  } catch (err) {
    console.log("ERROR");
    console.log(err);
  }
})();

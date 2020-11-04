//
// Run with: ts-node test/scripts/ts/test.ts
//

import { ArangoDB } from "../../../src/index";
import { fetchUserByName } from "../../resources/ts/queries";

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

//
// Run with: ts-node test/scripts/ts/test.ts
//

import * as path from "path";
import * as dotenv from "dotenv";
import { ArangoDB } from "../../../src/index";

dotenv.config({ path: path.join(__dirname, "../../integration/.env") });

(async function () {
  try {
    const db = new ArangoDB({
      databaseName: process.env.ARANGO_TEST_DB1_NAME,
      url: process.env.ARANGO_TEST_DB_URI,
    });

    // const johnByQuery = await db.queryOne(fetchUserByName("John"));
    // const johnByKey = await db.driver.collection("user").document(johnByQuery._key);

    // console.log(johnByQuery);
    // console.log(johnByKey);

    // const query = toConstraintValidationQueryV2({
    //   collection: "users",
    //   constraints: [{ unique: { key: "username", value: "chiefdoper" } }],
    // });

    // console.log(query);

    const result1 = await db.uniqueConstraintValidation({
      collection: "users",
      constraints: [{ unique: { key: "username", value: "chiefdoper" } }],
    });

    console.log(result1);

    const result2 = await db.uniqueConstraintValidation({
      collection: "users",
      constraints: [{ unique: { key: "username", value: "thetrain" } }],
    });

    console.log(result2);

    // const result3 = await db.uniqueConstraintValidation({
    //   collection: "users",
    //   constraints: [{ unique: { key: "username", value: "thetrain" } }, { unique: { key: "name", value: "Lance" } }],
    // });

    // console.log(result3);

    // const result4 = await db.uniqueConstraintValidation({
    //   collection: "users",
    //   constraints: [{ unique: { key: "username", value: "thetrain" } }, { unique: { key: "name", value: "Thomas" } }],
    // });

    // console.log(result4);
  } catch (err) {
    console.log(err.response.body);
  }
})();

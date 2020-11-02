import * as path from "path";
import * as dotenv from "dotenv";
import { ArangoDB } from "../../src/index";
import { fetchUserByName } from "../resources/ts/queries";

dotenv.config({ path: path.join(__dirname, ".env") });

const db = new ArangoDB({
  databaseName: process.env.ARANGO_DB_NAME,
  url: process.env.ARANGO_CONNECTION_URI,
});

const USER_COLLECTION = "user";

describe("Arango Backseat Driver Integration Tests", () => {
  // beforeEach(() => {
  //   client.authenticate(process.env.SCORMCLOUD_APP_ID, process.env.SCORMCLOUD_SECRET_KEY, process.env.SCORMCLOUD_SCOPE);
  // });

  test("Ping ScormCloud API", async () => {
    expect.assertions(1);

    try {
      const johnByQuery = await db.queryOne(fetchUserByName("John"));
      const johnByKey = await db.driver.collection(USER_COLLECTION).document(johnByQuery._key);

      expect(johnByKey._key).toEqual(johnByQuery._key);
    } catch (err) {
      console.log(err);
    }
  });
});

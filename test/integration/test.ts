import * as path from "path";
import * as dotenv from "dotenv";
import { ArangoDB } from "../../src/index";
import { DBStructure } from "../../src/types";

dotenv.config({ path: path.join(__dirname, ".env") });

const testDB1 = process.env.ARANGO_TEST_DB1_NAME;
const testDB2 = process.env.ARANGO_TEST_DB2_NAME;

const CONST = {
  userCollection: "users",
  groupCollection: "groups",
  userToGroupEdge: "user_groups",
  groupMembershipGraph: "group_membership",
};

const dbStructure: DBStructure = {
  database: testDB2,
  collections: [CONST.userCollection, CONST.groupCollection],
  graphs: [
    {
      graph: CONST.groupMembershipGraph,
      edges: [
        {
          collection: CONST.userToGroupEdge,
          from: [CONST.userCollection],
          to: [CONST.groupCollection],
        },
      ],
    },
  ],
};

const db = new ArangoDB({
  url: process.env.ARANGO_TEST_DB_URI,
  // databaseName: testDB,
});

describe("Arango Backseat Driver Integration Tests", () => {
  // test("Hello", async () => {
  //   expect.assertions(1);
  //   try {
  //     const johnByQuery = await db.queryOne(fetchUserByName("John"));
  //     const johnByKey = await db.driver.collection(USER_COLLECTION).document(johnByQuery._key);
  //     expect(johnByKey._key).toEqual(johnByQuery._key);
  //   } catch (err) {
  //     console.log(err);
  //   }
  // });

  test("Create database", async () => {
    expect.assertions(5);

    // confirm that at least one database is already present
    const dbList = await db.driver.listDatabases();
    expect(dbList.length).toBeGreaterThanOrEqual(1);

    // JS version that tests what happens when no arg supplied
    // confirm that neither of the test DBs exist
    let testDB1Exists = await db.databaseExists(testDB1);
    let testDB2Exists = await db.databaseExists(testDB2);

    expect(testDB1Exists).toBeFalsy();
    expect(testDB2Exists).toBeFalsy();

    await db.driver.createDatabase(testDB2);

    testDB1Exists = await db.databaseExists(testDB1);
    testDB2Exists = await db.databaseExists(testDB2);

    expect(testDB1Exists).toBeFalsy();
    expect(testDB2Exists).toBeTruthy();
  });

  test("Create database structure and test multi-driver behaviour", async () => {
    // create structure for existing DB
    const result1 = await db.createDBStructure(dbStructure);

    // create structure for non-existing DB
    dbStructure.database = testDB1;
    const result2 = await db.createDBStructure(dbStructure);

    expect(result1.database).toEqual("Database found");
    expect(result1.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' created`]));
    expect(result1.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' created`,
      ])
    );

    expect(result2.database).toEqual("Database created");
    expect(result2.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' created`]));
    expect(result2.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' created`,
      ])
    );

    // confirm non-existent DB was created
    const testDB1Exists = await db.databaseExists(testDB1);
    expect(testDB1Exists).toBeTruthy();

    // check that expected collections exist and that different drivers behave as expected
    const currentDriverNameBefore = db.driver.name;
    const testDB1Driver = db.driver.database(testDB1);
    const testDB2Driver = db.driver.database(testDB2);
    const testDB1DriverName = testDB1Driver.name;
    const testDB2DriverName = testDB2Driver.name;
    const currentDriverNameAfter = db.driver.name;

    const collecionListSystem = await db.driver.listCollections();
    const collecionList1 = await testDB1Driver.listCollections();
    const collecionList2 = await testDB2Driver.listCollections();

    expect(currentDriverNameBefore).toEqual("_system");
    expect(testDB1DriverName).toEqual(testDB1);
    expect(testDB2DriverName).toEqual(testDB2);
    expect(currentDriverNameAfter).toEqual("_system");

    expect(collecionListSystem.length).toEqual(0);
    expect(collecionList1.length).toEqual(3);
    expect(collecionList2.length).toEqual(3);

    const usersCollectionOnSystemDB1 = await db.driver.collection(CONST.userCollection).exists();
    const usersCollectionOnSystemDB2 = await db.collectionExists(CONST.userCollection);
    const usersCollectionExist = await db.collectionExists(CONST.userCollection, testDB1);
    const groupsCollectionExist = await db.collectionExists(CONST.groupCollection, testDB1);
    const userGroupsCollectionExist = await db.collectionExists(CONST.userToGroupEdge, testDB1);

    expect(usersCollectionOnSystemDB1).toBeFalsy();
    expect(usersCollectionOnSystemDB2).toBeFalsy();
    expect(usersCollectionExist).toBeTruthy();
    expect(groupsCollectionExist).toBeTruthy();
    expect(userGroupsCollectionExist).toBeTruthy();

    // remove a collection and recreate the structure
    testDB1Driver.collection(CONST.userCollection).drop();
    const usersCollectionExist2 = await db.collectionExists(CONST.userCollection, testDB1);
    expect(usersCollectionExist2).toBeFalsy();

    const result3 = await db.createDBStructure(dbStructure);

    expect(result3.database).toEqual("Database found");
    expect(result3.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' found`]));
    expect(result3.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' found`,
      ])
    );

    const usersCollectionExist3 = await db.collectionExists(CONST.userCollection, testDB1);
    expect(usersCollectionExist3).toBeTruthy();
  });

  test("Delete database", async () => {
    expect.assertions(5);

    await db.driver.dropDatabase(testDB1);
    await db.driver.dropDatabase(testDB2);

    const testDB1Exists = await db.databaseExists(testDB1);
    const testDB2Exists = await db.databaseExists(testDB2);

    expect(testDB1Exists).toBeFalsy();
    expect(testDB2Exists).toBeFalsy();

    try {
      await db.driver.dropDatabase(testDB1);
    } catch (e) {
      expect(e.response.body.code).toEqual(404);
      expect(e.response.body.errorNum).toEqual(1228);
      expect(e.response.body.errorMessage).toEqual("database not found");
    }
  });
});

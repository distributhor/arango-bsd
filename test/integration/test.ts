import * as path from "path";
import * as dotenv from "dotenv";
import { ArangoDB } from "../../src/driver";
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
  database: undefined,
  collections: [CONST.userCollection, CONST.groupCollection],
  graphs: [
    {
      graph: CONST.groupMembershipGraph,
      edges: [
        {
          collection: CONST.userToGroupEdge,
          from: CONST.userCollection,
          to: CONST.groupCollection,
        },
      ],
    },
  ],
};

const db = new ArangoDB({
  url: process.env.ARANGO_TEST_DB_URI,
});

describe("Arango Backseat Driver Integration Tests", () => {
  test("Create database", async () => {
    expect.assertions(5);

    // confirm that at least one database is already present
    const dbList = await db.driver.listDatabases();
    expect(dbList.length).toBeGreaterThanOrEqual(1);

    // TODO: JS version that tests what happens when no arg supplied
    // confirm that neither of the test DBs exist
    let testDB1Exists = await db.databaseExists(testDB1);
    let testDB2Exists = await db.databaseExists(testDB2);

    expect(testDB1Exists).toBeFalsy();
    expect(testDB2Exists).toBeFalsy();

    await db.driver.createDatabase(testDB1);

    testDB1Exists = await db.databaseExists(testDB1);
    testDB2Exists = await db.databaseExists(testDB2);

    expect(testDB1Exists).toBeTruthy();
    expect(testDB2Exists).toBeFalsy();
  });

  test("Create database structure and test multi-driver behaviour", async () => {
    // create structure for existing DB
    dbStructure.database = testDB1;
    const result1 = await db.createDBStructure(dbStructure);

    // create structure for non-existing DB
    dbStructure.database = testDB2;
    const result2 = await db.createDBStructure(dbStructure);

    expect(result1.database).toEqual("Database found");
    expect(result1.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' created`]));
    expect(result1.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' created`,
      ])
    );

    // TODO: confirm that removal and re-creation of collection doesn't affect dependent graph ?
    expect(result2.database).toEqual("Database created");
    expect(result2.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' created`]));
    expect(result2.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' created`,
      ])
    );

    // confirm non-existent DB was created
    const testDB2Exists = await db.databaseExists(testDB2);
    expect(testDB2Exists).toBeTruthy();

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
    testDB2Driver.collection(CONST.userCollection).drop();
    const usersCollectionExist2 = await db.collectionExists(CONST.userCollection, testDB2);
    expect(usersCollectionExist2).toBeFalsy();

    dbStructure.database = testDB2;
    const result3 = await db.createDBStructure(dbStructure);

    expect(result3.database).toEqual("Database found");
    expect(result3.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' found`]));
    expect(result3.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' found`,
      ])
    );

    const usersCollectionExist3 = await db.collectionExists(CONST.userCollection, testDB2);
    expect(usersCollectionExist3).toBeTruthy();

    // confirm that empty array values do not break anything, ie, that they
    // are essentially unhandled and nothing happens, so it's a safe operation
    const dbStructureWithEmptyArrays: DBStructure = {
      database: testDB2,
      collections: [],
      graphs: [
        {
          graph: "xyz",
          edges: [],
        },
      ],
    };

    const result4 = await db.createDBStructure(dbStructureWithEmptyArrays);

    expect(result4.database).toEqual("Database found");
    expect(result4.collections.length).toEqual(0);
    expect(result4.graphs.length).toEqual(0);
  });

  test("Validate database structure", async () => {
    dbStructure.collections.push("abc");
    dbStructure.graphs.push({
      graph: "def",
      edges: undefined,
    });

    const result = await db.validateDBStructure(dbStructure);

    expect(result.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: CONST.userCollection, exists: true }),
        expect.objectContaining({ name: CONST.groupCollection, exists: true }),
        expect.objectContaining({ name: "abc", exists: false }),
      ])
    );

    expect(result.graphs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: CONST.groupMembershipGraph, exists: true }),
        expect.objectContaining({ name: "def", exists: false }),
      ])
    );
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

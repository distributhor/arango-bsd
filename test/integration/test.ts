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

const arango = new ArangoDB({
  url: process.env.ARANGO_TEST_DB_URI,
});

/*
const groups = [
  {
    name: "Dev",
    tags: ["technical"],
  },
  {
    name: "Admin",
    tags: ["business"],
  },
  {
    name: "Marketing",
    tags: ["business"],
  },
  {
    name: "Support",
    tags: ["technical", "business"],
  },
  {
    name: "CPT",
    tags: ["city"],
  },
  {
    name: "JHB",
    tags: ["city"],
  },
];
*/

const users = [
  {
    name: "Lance",
    surname: "Armstrong",
    username: "chiefdoper",
    country: "USA",
    team: "US Postal",
    role: "GC",
  },
  {
    name: "George",
    surname: "Hincapie",
    username: "steamtrain",
    country: "USA",
    team: "US Postal",
    role: "Domestique",
  },
  {
    name: "Ivan",
    surname: "Basso",
    username: "closebutnotquite",
    country: "Italy",
    team: "CSC",
    role: "GC",
  },
  {
    name: "Jan",
    surname: "Ullrich",
    username: "wishiwas3kglighter",
    country: "Germany",
    team: "T Mobile",
    role: "GC",
  },
  {
    name: "Alberto",
    surname: "Contador",
    username: "pistolero",
    country: "Spain",
    team: "Saxobank Tinkoff",
    role: "GC",
  },
  {
    name: "Alejandro",
    surname: "Valverda",
    username: "stillgoing",
    country: "Spain",
    team: "Movistar",
  },
  {
    name: "Mathieu",
    surname: "van der Poel",
    username: "bossofcross",
    team: "Alpecin Fenix",
    role: "Classics",
  },
  {
    name: "Wout",
    surname: "van Aert",
    username: "Jumbo Visma",
    role: "Classics",
  },
  {
    name: "Tadej",
    surname: "Pogačar",
    username: "UAE Emirates",
    role: "GC",
  },
];

describe("Arango Backseat Driver Integration Tests", () => {
  test("Create database", async () => {
    expect.assertions(5);

    // confirm that at least one database is already present
    const dbList = await arango.driver.listDatabases();
    expect(dbList.length).toBeGreaterThanOrEqual(1);

    // TODO: JS version that tests what happens when no arg supplied
    // confirm that neither of the test DBs exist
    let testDB1Exists = await arango.databaseExists(testDB1);
    let testDB2Exists = await arango.databaseExists(testDB2);

    expect(testDB1Exists).toBeFalsy();
    expect(testDB2Exists).toBeFalsy();

    await arango.driver.createDatabase(testDB1);

    testDB1Exists = await arango.databaseExists(testDB1);
    testDB2Exists = await arango.databaseExists(testDB2);

    expect(testDB1Exists).toBeTruthy();
    expect(testDB2Exists).toBeFalsy();
  });

  test("Create database structure and test multi-driver behaviour", async () => {
    // create structure for existing DB
    dbStructure.database = testDB1;
    const result1 = await arango.createDBStructure(dbStructure);

    // create structure for non-existing DB
    dbStructure.database = testDB2;
    const result2 = await arango.createDBStructure(dbStructure);

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
    const testDB2Exists = await arango.databaseExists(testDB2);
    expect(testDB2Exists).toBeTruthy();

    // check that expected collections exist and that different drivers behave as expected
    const currentDriverNameBefore = arango.driver.name;
    const testDB1Driver = arango.driver.database(testDB1);
    const testDB2Driver = arango.driver.database(testDB2);
    const testDB1DriverName = testDB1Driver.name;
    const testDB2DriverName = testDB2Driver.name;
    const currentDriverNameAfter = arango.driver.name;

    const collecionListSystem = await arango.driver.listCollections();
    const collecionList1 = await testDB1Driver.listCollections();
    const collecionList2 = await testDB2Driver.listCollections();

    expect(currentDriverNameBefore).toEqual("_system");
    expect(testDB1DriverName).toEqual(testDB1);
    expect(testDB2DriverName).toEqual(testDB2);
    expect(currentDriverNameAfter).toEqual("_system");

    expect(collecionListSystem.length).toEqual(0);
    expect(collecionList1.length).toEqual(3);
    expect(collecionList2.length).toEqual(3);

    const usersCollectionOnSystemDB1 = await arango.driver.collection(CONST.userCollection).exists();
    const usersCollectionOnSystemDB2 = await arango.collectionExists(CONST.userCollection);

    const usersCollectionExist = await arango.db(testDB1).collectionExists(CONST.userCollection);
    const groupsCollectionExist = await arango.db(testDB1).collectionExists(CONST.groupCollection);
    const userGroupsCollectionExist = await arango.db(testDB1).collectionExists(CONST.userToGroupEdge);

    expect(usersCollectionOnSystemDB1).toBeFalsy();
    expect(usersCollectionOnSystemDB2).toBeFalsy();
    expect(usersCollectionExist).toBeTruthy();
    expect(groupsCollectionExist).toBeTruthy();
    expect(userGroupsCollectionExist).toBeTruthy();

    // remove a collection and recreate the structure
    testDB2Driver.collection(CONST.userCollection).drop();
    const usersCollectionExist2 = await arango.db(testDB2).collectionExists(CONST.userCollection);
    expect(usersCollectionExist2).toBeFalsy();

    dbStructure.database = testDB2;
    const result3 = await arango.createDBStructure(dbStructure);

    expect(result3.database).toEqual("Database found");
    expect(result3.graphs).toEqual(expect.arrayContaining([`Graph '${CONST.groupMembershipGraph}' found`]));
    expect(result3.collections).toEqual(
      expect.arrayContaining([
        `Collection '${CONST.userCollection}' created`,
        `Collection '${CONST.groupCollection}' found`,
      ])
    );

    const usersCollectionExist3 = await arango.db(testDB2).collectionExists(CONST.userCollection);
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

    const result4 = await arango.createDBStructure(dbStructureWithEmptyArrays);

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

    const result = await arango.validateDBStructure(dbStructure);

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

  test("Import test data", async () => {
    // Bulk vs Batch ...
    // Doing a nativeJsDriver.create() with an array of data seems like it issues a batch operation against
    // the Arango API (perform multiple create() actions in the background), while a nativeJsDriver.import()
    // performs a bulk import using one connection.

    // const driver = arango.driver.database(testDB);
    // const result = await driver.collection(CONST.userCollection).save(bulkUsersFixture);

    const result = await arango.db(testDB1).create(CONST.userCollection, users);
    console.log(result);

    expect(result.length).toEqual(9);
  });

  test("Unique constraint validation", async () => {
    const result1 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { key: "username", value: "chiefdoper" } }],
    });

    expect(result1.unique).toBeFalsy();

    const result2 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { key: "username", value: "thetrain" } }],
    });

    expect(result2.unique).toBeTruthy();

    const result3 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { key: "username", value: "thetrain" } }, { unique: { key: "name", value: "Lance" } }],
    });

    expect(result3.unique).toBeFalsy();

    const result4 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { key: "username", value: "thetrain" } }, { unique: { key: "name", value: "Thomas" } }],
    });

    expect(result4.unique).toBeTruthy();
  });

  test("Delete database", async () => {
    expect.assertions(5);

    await arango.driver.dropDatabase(testDB1);
    await arango.driver.dropDatabase(testDB2);

    const testDB1Exists = await arango.databaseExists(testDB1);
    const testDB2Exists = await arango.databaseExists(testDB2);

    expect(testDB1Exists).toBeFalsy();
    expect(testDB2Exists).toBeFalsy();

    try {
      await arango.driver.dropDatabase(testDB1);
    } catch (e) {
      expect(e.response.body.code).toEqual(404);
      expect(e.response.body.errorNum).toEqual(1228);
      expect(e.response.body.errorMessage).toEqual("database not found");
    }
  });
});

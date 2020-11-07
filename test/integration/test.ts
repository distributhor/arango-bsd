import * as path from "path";
import * as dotenv from "dotenv";
import { ArangoDB } from "../../src/index";
import { DBStructure } from "../../src/types";

import cyclists from "./cyclists.json";
import teams from "./teams.json";

dotenv.config({ path: path.join(__dirname, ".env") });

const testDB1 = process.env.ARANGO_TEST_DB1_NAME;
const testDB2 = process.env.ARANGO_TEST_DB2_NAME;

const CONST = {
  userCollection: "cyclists",
  groupCollection: "teams",
  userToGroupEdge: "team_members",
  groupMembershipGraph: "team_membership",
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

describe("Arango Backseat Driver Integration Tests", () => {
  /* 
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
    const result1 = await arango.db(testDB1).create(CONST.userCollection, cyclists);
    const result2 = await arango.db(testDB1).create(CONST.groupCollection, teams);

    expect(result1.length).toEqual(25);
    expect(result2.length).toEqual(15);
  });

  test("Unique constraint validation", async () => {
    const result1 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { key: "nickname", value: "Chief Doper" } }],
    });

    expect(result1.violatesUniqueConstraint).toBeTruthy();

    const result2 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { key: "nickname", value: "Tornado" } }],
    });

    expect(result2.violatesUniqueConstraint).toBeFalsy();

    const result3 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        { unique: { key: "nickname", value: "Tornado" } },
        { unique: { key: "surname", value: "Armstrong" } },
      ],
    });

    expect(result3.violatesUniqueConstraint).toBeTruthy();

    const result4 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        { unique: { key: "nickname", value: "Tornado" } },
        { unique: { key: "surname", value: "Voeckler" } },
      ],
    });

    expect(result4.violatesUniqueConstraint).toBeFalsy();

    const result5 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        {
          composite: [
            { key: "name", value: "Thomas" },
            { key: "surname", value: "de Ghent" },
          ],
        },
      ],
    });

    expect(result5.violatesUniqueConstraint).toBeTruthy();

    const result6 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        {
          composite: [
            { key: "name", value: "Thomas" },
            { key: "surname", value: "Voeckler" },
          ],
        },
      ],
    });

    expect(result6.violatesUniqueConstraint).toBeFalsy();
  });

  test("Query ALL and query ONE, fetch and fetchOne", async () => {
    const result1A = await arango
      .db(testDB1)
      .queryAll(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Time Trial" RETURN d`);

    expect(result1A.length).toEqual(4);
    expect(result1A[0].surname).toBeDefined();

    const result1B = await arango.db(testDB1).fetchByPropertyValue(CONST.userCollection, "speciality", "Time Trial");
    expect(result1B.length).toEqual(4);
    expect(result1B[0].surname).toBeDefined();

    const result2A = await arango
      .db(testDB1)
      .queryAll(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Trail Running" RETURN d`);

    expect(result2A).toBeDefined();
    expect(Array.isArray(result2A)).toBeTruthy();
    expect(result2A.length).toEqual(0);

    const result2B = await arango.db(testDB1).fetchByPropertyValue(CONST.userCollection, "speciality", "Trail Running");

    expect(result2B).toBeDefined();
    expect(Array.isArray(result2B)).toBeTruthy();
    expect(result2B.length).toEqual(0);

    const result3A = await arango
      .db(testDB1)
      .queryOne(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Trail Running" RETURN d`);

    expect(result3A).toBeUndefined();

    const result3B = await arango
      .db(testDB1)
      .fetchOneByPropertyValue(CONST.userCollection, "speciality", "Trail Running");

    expect(result3B).toBeUndefined();

    const result4A = await arango
      .db(testDB1)
      .queryOne(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Time Trial" RETURN d`);

    expect(result4A).toBeDefined();
    expect(result4A.surname).toBeDefined();

    const result4B = await arango.db(testDB1).fetchOneByPropertyValue(CONST.userCollection, "speciality", "Time Trial");

    expect(result4B).toBeDefined();
    expect(result4B.surname).toBeDefined();

    const result5A = await arango
      .db(testDB1)
      .queryOne(`FOR d IN ${CONST.userCollection} FILTER d.surname LIKE "Armstrong" RETURN d`);

    expect(result5A).toBeDefined();
    expect(result5A.name).toEqual("Lance");

    const result5B = await arango.db(testDB1).fetchOneByPropertyValue(CONST.userCollection, "surname", "Armstrong");

    expect(result5B).toBeDefined();
    expect(result5B.name).toEqual("Lance");
  });
  */
  /*
  test("Create document", async () => {
    const result1 = await arango.db(testDB1).create(CONST.userCollection, {
      name: "Daryl",
      surname: "Impey",
      country: "South Africa",
      speciality: "All Rounder",
    });

    console.log(result1);
    // expect(result1.length).toEqual(4);
    // expect(result1[0].surname).toBeDefined();
  });
  */
  /*
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
  */
});

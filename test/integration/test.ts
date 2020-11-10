import * as path from "path";
import * as dotenv from "dotenv";
import { ArrayCursor } from "arangojs/cursor";
import { ArangoDB } from "../../src/index";
import { DBStructure, QueryResult, QueryReturnType } from "../../src/types";

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
  /* */
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

    expect(result1.length).toEqual(24);
    expect(result2.length).toEqual(16);
  });

  test("Unique constraint validation", async () => {
    const result1 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { property: "nickname", value: "Chief Doper" } }],
    });

    expect(result1.violatesUniqueConstraint).toBeTruthy();

    const result2 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [{ unique: { property: "nickname", value: "Tornado" } }],
    });

    expect(result2.violatesUniqueConstraint).toBeFalsy();

    const result3 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        { unique: { property: "nickname", value: "Tornado" } },
        { unique: { property: "surname", value: "Armstrong" } },
      ],
    });

    expect(result3.violatesUniqueConstraint).toBeTruthy();

    const result4 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        { unique: { property: "nickname", value: "Tornado" } },
        { unique: { property: "surname", value: "Voeckler" } },
      ],
    });

    expect(result4.violatesUniqueConstraint).toBeFalsy();

    const result5 = await arango.db(testDB1).uniqueConstraintValidation({
      collection: CONST.userCollection,
      constraints: [
        {
          composite: [
            { property: "name", value: "Thomas" },
            { property: "surname", value: "de Ghent" },
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
            { property: "name", value: "Thomas" },
            { property: "surname", value: "Voeckler" },
          ],
        },
      ],
    });

    expect(result6.violatesUniqueConstraint).toBeFalsy();
  });

  test("CRUD", async () => {
    const result1A = await arango.db(testDB1).create(CONST.userCollection, {
      name: "Daryl",
      surname: "Impey",
      country: "South Africa",
      speciality: "All Rounder",
      _secret: "Rusks",
      results: {
        2014: ["1st, Tour of Alberta", "1st, SA Champs TT", "2nd, SA Champs Road Race"],
        2015: ["2nd, Vuelta a La Rioja"],
        2017: ["1st, 94.7 Cycle Challenge"],
        2018: ["1st, SA Champs TT", "1st, SA Champs Road Race", "1st, Tour Down Under"],
      },
      rating: {
        sprint: 8,
        climb: 7,
        timetrial: 8,
        punch: 8,
        descend: 7,
      },
    });

    expect(result1A).toBeDefined();
    expect(result1A._key).toBeDefined();

    const result1B = await arango.db(testDB1).read(CONST.userCollection, result1A._key);

    expect(result1B.name).toEqual("Daryl");
    expect(result1B.surname).toEqual("Impey");
    expect(result1B._secret).toEqual("Rusks");
    expect(result1B.results[2018].length).toEqual(3);
    expect(result1B.rating.timetrial).toEqual(8);

    const result1C = await arango.db(testDB1).read(CONST.userCollection, result1A._key, { stripUnderscoreProps: true });

    expect(result1C.name).toEqual("Daryl");
    expect(result1C.surname).toEqual("Impey");
    expect(result1C._secret).toBeUndefined();
    expect(result1C.results[2018].length).toEqual(3);
    expect(result1C.rating.timetrial).toEqual(8);

    const result1D = await arango.db(testDB1).read(CONST.userCollection, "Impey", { identifier: "surname" });

    expect(result1D.name).toEqual("Daryl");
    expect(result1D.surname).toEqual("Impey");
    expect(result1D._secret).toEqual("Rusks");
    expect(result1D.results[2018].length).toEqual(3);
    expect(result1D.rating.timetrial).toEqual(8);

    const result1E = await arango
      .db(testDB1)
      .read(CONST.userCollection, "Impey", { identifier: "surname", stripUnderscoreProps: true });

    expect(result1E.name).toEqual("Daryl");
    expect(result1E.surname).toEqual("Impey");
    expect(result1E._secret).toBeUndefined();
    expect(result1E.results[2018].length).toEqual(3);
    expect(result1E.rating.timetrial).toEqual(8);

    const result2A = await arango.db(testDB1).create(
      CONST.userCollection,
      {
        name: "Cadel",
        surname: "Evans",
        country: "Australia",
        speciality: "GC",
        _secret: "Smiling",
        results: {
          2010: ["1st, La Flèche Wallonne", "5th, Giro d'Italia", "6th, Tour Down Under"],
          2015: ["1st, Tour de France", "1st, Tirreno–Adriatico", "1st Tour de Romandie"],
          2012: ["7th, Tour de France"],
          2013: ["3rd, Giro d'Italia"],
        },
        rating: {
          sprint: 6,
          climb: 8,
          timetrial: 9,
          punch: 8,
          descend: 7,
        },
      },
      { stripUnderscoreProps: true }
    );

    expect(result2A).toBeDefined();
    expect(result2A._key).toBeDefined();

    const result2B = await arango.db(testDB1).read(CONST.userCollection, result2A._key);

    expect(result2B.name).toEqual("Cadel");
    expect(result2B.surname).toEqual("Evans");
    expect(result2B._secret).toBeUndefined();
    expect(result2B.results[2012].length).toEqual(1);
    expect(result2B.rating.sprint).toEqual(6);

    const result2C = await arango.db(testDB1).update(CONST.userCollection, result2A._key, {
      nickname: "G'day Mate",
      speciality: "All Rounder",
      results: { 2012: ["3rd, Critérium du Dauphiné"] },
      rating: { sprint: 7 },
    });

    expect(result2C._key).toBeDefined();
    expect(result2C._rev).toBeDefined();
    expect(result2C._oldRev).toBeDefined();

    const result2D = await arango.db(testDB1).read(CONST.userCollection, result2A._key);
    expect(result2D.name).toEqual("Cadel");
    expect(result2D.surname).toEqual("Evans");
    expect(result2D.nickname).toEqual("G'day Mate");
    expect(result2D.speciality).toEqual("All Rounder");
    expect(result2D.results["2012"]).toEqual(expect.arrayContaining(["3rd, Critérium du Dauphiné"]));
    expect(result2D.results["2013"]).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]));
    expect(result2D.rating).toEqual(
      expect.objectContaining({
        sprint: 7,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7,
      })
    );

    const result2E = await arango.db(testDB1).update(
      CONST.userCollection,
      "Evans",
      {
        nickname: "Too Nice",
        speciality: "GC",
        results: { 2009: ["1st, UCI Road Race World Champs"] },
        rating: { solo: 8 },
      },
      { identifier: "surname" }
    );

    expect(result2E).toBeDefined();
    expect(Array.isArray(result2E)).toBeTruthy();
    expect(result2E.length).toEqual(1);
    expect(result2E[0]._key).toBeDefined();
    expect(result2E[0]._rev).toBeDefined();
    expect(result2E[0]._oldRev).toBeDefined();

    const result2F = await arango.db(testDB1).read(CONST.userCollection, result2A._key);

    expect(result2F.name).toEqual("Cadel");
    expect(result2F.surname).toEqual("Evans");
    expect(result2F.nickname).toEqual("Too Nice");
    expect(result2F.speciality).toEqual("GC");
    expect(result2F.results["2012"]).toEqual(expect.arrayContaining(["3rd, Critérium du Dauphiné"]));
    expect(result2F.results["2013"]).toEqual(expect.arrayContaining(["3rd, Giro d'Italia"]));
    expect(result2F.results["2009"]).toEqual(expect.arrayContaining(["1st, UCI Road Race World Champs"]));
    expect(result2F.rating).toEqual(
      expect.objectContaining({
        sprint: 7,
        climb: 8,
        timetrial: 9,
        punch: 8,
        descend: 7,
        solo: 8,
      })
    );

    const result2G = await arango.db(testDB1).read(CONST.userCollection, "Evans", { identifier: "surname" });

    expect(result2G.name).toEqual("Cadel");
    expect(result2G.surname).toEqual("Evans");

    const result2H = await arango.db(testDB1).delete(CONST.userCollection, result2A._key);

    expect(result2H._key).toBeDefined();
    expect(result2H._rev).toBeDefined();

    const result2I = await arango.db(testDB1).read(CONST.userCollection, result2A._key);

    expect(result2I).toBeUndefined();

    const result2J = await arango.db(testDB1).read(CONST.userCollection, "Evans", { identifier: "surname" });

    expect(result2J).toBeUndefined();

    const result3A = await arango.db(testDB1).create(CONST.userCollection, {
      name: "Thomas",
      surname: "Voeckler",
      country: "France",
    });

    expect(result3A).toBeDefined();
    expect(result3A._key).toBeDefined();

    const result3B = await arango.db(testDB1).read(CONST.userCollection, result3A._key);

    expect(result3B.name).toEqual("Thomas");
    expect(result3B.surname).toEqual("Voeckler");

    const result3C = await arango.db(testDB1).delete(CONST.userCollection, "Voeckler", { identifier: "surname" });

    expect(result3C).toBeDefined();
    expect(Array.isArray(result3C)).toBeTruthy();
    expect(result3C.length).toEqual(1);
    expect(result3C[0]._key).toBeDefined();
    expect(result3C[0]._rev).toBeDefined();

    const result3D = await arango.db(testDB1).read(CONST.userCollection, result3A._key);

    expect(result3D).toBeUndefined();

    const result4A = await arango.db(testDB1).update(
      CONST.userCollection,
      "Time Trial",
      {
        rating: { timetrial: 9 },
      },
      { identifier: "speciality" }
    );

    expect(result4A).toBeDefined();
    expect(Array.isArray(result4A)).toBeTruthy();
    expect(result4A.length).toEqual(3);
    expect(result4A[0]._key).toBeDefined();
    expect(result4A[0]._rev).toBeDefined();
    expect(result4A[0]._oldRev).toBeDefined();

    const result4B = (await arango
      .db(testDB1)
      .fetchAllByPropertyValue(CONST.userCollection, { property: "speciality", value: "Time Trial" })) as QueryResult;

    expect(result4B.data.length).toEqual(3);
    expect(result4B.data[0].rating.timetrial).toEqual(9);

    const result5A = await arango.db(testDB1).delete(CONST.userCollection, "Break Aways", { identifier: "speciality" });

    expect(result5A).toBeDefined();
    expect(Array.isArray(result5A)).toBeTruthy();
    expect(result5A.length).toEqual(1);

    const result5B = (await arango
      .db(testDB1)
      .fetchAllByPropertyValue(CONST.userCollection, { property: "speciality", value: "Break Aways" })) as QueryResult;

    expect(result5B.data.length).toEqual(0);
  });

  test("queryAll, queryOne, fetch and fetchOne", async () => {
    const result1A = await arango
      .db(testDB1)
      .queryAll(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Time Trial" RETURN d`);

    expect(result1A.length).toEqual(3);
    expect(result1A[0].surname).toBeDefined();

    const result1B = (await arango
      .db(testDB1)
      .fetchAllByPropertyValue(CONST.userCollection, { property: "speciality", value: "Time Trial" })) as QueryResult;

    expect(result1B.data.length).toEqual(3);
    expect(result1B.data[0].name).toBeDefined();
    expect(result1B.data[0].surname).toBeDefined();
    expect(result1B.data[0]._key).toBeDefined();
    expect(result1B.data[0]._id).toBeDefined();
    expect(result1B.data[0]._rev).toBeDefined();

    const result1C = (await arango.db(testDB1).fetchAllByPropertyValue(
      CONST.userCollection,
      { property: "speciality", value: "Time Trial" },
      {
        stripUnderscoreProps: true,
      }
    )) as QueryResult;

    expect(result1C.data.length).toEqual(3);
    expect(result1C.data[0].name).toBeDefined();
    expect(result1C.data[0].surname).toBeDefined();
    expect(result1C.data[0]._key).toBeDefined();
    expect(result1C.data[0]._id).toBeUndefined();
    expect(result1C.data[0]._rev).toBeUndefined();

    const result1D = (await arango.db(testDB1).fetchAllByPropertyValue(
      CONST.userCollection,
      { property: "speciality", value: "Time Trial" },
      {
        stripInternalProps: true,
      }
    )) as QueryResult;

    expect(result1D.data.length).toEqual(3);
    expect(result1D.data[0].name).toBeDefined();
    expect(result1D.data[0].surname).toBeDefined();
    expect(result1D.data[0]._key).toBeDefined();
    expect(result1D.data[0]._id).toBeUndefined();
    expect(result1D.data[0]._rev).toBeUndefined();

    const result1E = (await arango.db(testDB1).fetchAllByPropertyValue(
      CONST.userCollection,
      { property: "speciality", value: "Time Trial" },
      {
        return: QueryReturnType.CURSOR,
      }
    )) as ArrayCursor;

    expect(result1E instanceof ArrayCursor).toBeTruthy();
    const allDocs = await result1E.all();
    expect(allDocs[0].surname).toBeDefined();

    const result2A = await arango
      .db(testDB1)
      .queryAll(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Trail Running" RETURN d`);

    expect(result2A).toBeDefined();
    expect(Array.isArray(result2A)).toBeTruthy();
    expect(result2A.length).toEqual(0);

    const result2B = (await arango.db(testDB1).fetchAllByPropertyValue(CONST.userCollection, {
      property: "speciality",
      value: "Trail Running",
    })) as QueryResult;

    expect(result2B.data).toBeDefined();
    expect(Array.isArray(result2B.data)).toBeTruthy();
    expect(result2B.data.length).toEqual(0);

    const result3A = await arango
      .db(testDB1)
      .queryOne(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Trail Running" RETURN d`);

    expect(result3A).toBeUndefined();

    const result3B = await arango
      .db(testDB1)
      .fetchOneByPropertyValue(CONST.userCollection, { property: "speciality", value: "Trail Running" });

    expect(result3B).toBeUndefined();

    const result4A = await arango
      .db(testDB1)
      .queryOne(`FOR d IN ${CONST.userCollection} FILTER d.speciality LIKE "Time Trial" RETURN d`);

    expect(result4A).toBeDefined();
    expect(result4A.surname).toBeDefined();

    const result4B = await arango
      .db(testDB1)
      .fetchOneByPropertyValue(CONST.userCollection, { property: "speciality", value: "Time Trial" });

    expect(result4B).toBeDefined();
    expect(result4B.surname).toBeDefined();

    const result5A = await arango
      .db(testDB1)
      .queryOne(`FOR d IN ${CONST.userCollection} FILTER d.surname LIKE "Impey" RETURN d`);

    expect(result5A).toBeDefined();
    expect(result5A.name).toEqual("Daryl");

    const result5B = await arango
      .db(testDB1)
      .fetchOneByPropertyValue(CONST.userCollection, { property: "surname", value: "Impey" });

    expect(result5B).toBeDefined();
    expect(result5B.name).toEqual("Daryl");
    expect(result5B.surname).toEqual("Impey");
    expect(result5B._secret).toEqual("Rusks");
    expect(result5B._key).toBeDefined();
    expect(result5B._id).toBeDefined();
    expect(result5B._rev).toBeDefined();

    const result5C = await arango
      .db(testDB1)
      .fetchOneByPropertyValue(
        CONST.userCollection,
        { property: "surname", value: "Impey" },
        { stripUnderscoreProps: true }
      );

    expect(result5C).toBeDefined();
    expect(result5C.name).toEqual("Daryl");
    expect(result5C.surname).toEqual("Impey");
    expect(result5C._secret).toBeUndefined();
    expect(result5C._key).toBeDefined();
    expect(result5C._id).toBeUndefined();
    expect(result5C._rev).toBeUndefined();

    const result5D = await arango
      .db(testDB1)
      .fetchOneByPropertyValue(
        CONST.userCollection,
        { property: "surname", value: "Impey" },
        { stripInternalProps: true }
      );

    expect(result5D).toBeDefined();
    expect(result5D.name).toEqual("Daryl");
    expect(result5D.surname).toEqual("Impey");
    expect(result5B._secret).toEqual("Rusks");
    expect(result5D._key).toBeDefined();
    expect(result5D._id).toBeUndefined();
    expect(result5D._rev).toBeUndefined();

    const result6A = (await arango.db(testDB1).fetchAllByCompositeValue(CONST.userCollection, [
      { property: "country", value: "Belgium" },
      { property: "speciality", value: "Classics" },
    ])) as QueryResult;

    expect(result6A.data.length).toEqual(2);
    expect(result6A.data[0].name === "Wout" || result6A.data[0].name === "Tim").toBeTruthy();
    expect(result6A.data[1].surname === "van Aert" || result6A.data[1].surname === "Wellens").toBeTruthy();

    const result6B = (await arango.db(testDB1).fetchAllByCompositeValue(CONST.userCollection, [
      { property: "country", value: "UK" },
      { property: "speciality", value: "Classics" },
    ])) as QueryResult;

    expect(result6B.data.length).toEqual(0);

    const result7A = await arango.db(testDB1).fetchOneByCompositeValue(CONST.userCollection, [
      { property: "country", value: "Belgium" },
      { property: "speciality", value: "Classics" },
    ]);

    expect(result7A.surname === "van Aert" || result7A.surname === "Wellens").toBeTruthy();

    const result7B = await arango.db(testDB1).fetchOneByCompositeValue(CONST.userCollection, [
      { property: "name", value: "Jan" },
      { property: "surname", value: "Ullrich" },
    ]);

    expect(result7B.surname).toEqual("Ullrich");

    const result7C = await arango.db(testDB1).fetchOneByCompositeValue(CONST.userCollection, [
      { property: "name", value: "Jan" },
      { property: "surname", value: "Armstrong" },
    ]);

    expect(result7C).toBeUndefined();
  });

  /* */
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

import { ListOfFilters, MatchType, QueryType } from "../../src";
import {
  fetchByCompositeKeyValue,
  fetchByKeyValue,
  findByFilterCriteria,
  uniqueConstraintQuery,
  _findAllIndicesOfSubString,
  _prefixPropertyNames,
} from "../../src/queries";

describe("Queries", () => {
  test("Find all indices of substring in string", () => {
    const str = ' LIKE("carrot", "ca%t") && name == "wk" || ( age == 42 && speciality != "timetrial"';

    const result1 = _findAllIndicesOfSubString(["||", "&&", "OR", "LIKE", "!=", "=="], str);
    const result2 = _findAllIndicesOfSubString("||", str);
    const result3 = _findAllIndicesOfSubString("&&", str);

    expect(result1).toEqual(
      expect.arrayContaining([
        { index: 1, value: "like" },
        { index: 24, value: "&&" },
        { index: 32, value: "==" },
        { index: 40, value: "||" },
        { index: 49, value: "==" },
        { index: 55, value: "&&" },
        { index: 69, value: "!=" },
      ])
    );
    expect(result2).toEqual(expect.arrayContaining([{ index: 40, value: "||" }]));
    expect(result3).toEqual(
      expect.arrayContaining([
        { index: 24, value: "&&" },
        { index: 55, value: "&&" },
      ])
    );

    expect(str.indexOf("||")).toEqual(40);
    expect(str.indexOf("&&")).toEqual(24);
    expect(str.indexOf("&&", 25)).toEqual(55);
    expect(str.indexOf("LIKE")).toEqual(1);
    expect(str.indexOf("!=")).toEqual(69);
    expect(str.indexOf("==")).toEqual(32);
    expect(str.indexOf("==", 33)).toEqual(49);
  });

  test("Prefix property name in filter string", () => {
    const filter1 = 'name == "Thomas"';
    const filter2 = 'name == "Thomas" && age == 42';
    const filter3 = 'LIKE(name, "%thomas%", true)';
    const filter4 = 'LIKE(name, "%thomas%", true) || age IN arr';
    const filter5 = '(name == "Thomas" && age == 42) || name == "Lance"';
    const filter6 = '(name == "Thomas" && age == 42) || (name == "Lance" && surname == "Armstrong")';

    const result1 = _prefixPropertyNames(filter1);
    const result2 = _prefixPropertyNames(filter2);
    const result3 = _prefixPropertyNames(filter3);
    const result4 = _prefixPropertyNames(filter4);
    const result5 = _prefixPropertyNames(filter5);
    const result6 = _prefixPropertyNames(filter6);

    expect(result1).toEqual('d.name == "Thomas"');
    expect(result2).toEqual('d.name == "Thomas" && d.age == 42');
    expect(result3).toEqual('LIKE(d.name, "%thomas%", true)');
    expect(result4).toEqual('LIKE(d.name, "%thomas%", true) || d.age IN arr');
    expect(result5).toEqual('(d.name == "Thomas" && d.age == 42) || d.name == "Lance"');
    expect(result6).toEqual('(d.name == "Thomas" && d.age == 42) || (d.name == "Lance" && d.surname == "Armstrong")');
  });

  test("Find by filter criteria", async () => {
    const FILTER_1 = '(name == "Thomas" && age == 42) || name == "Lance"';
    const FILTER_2 = '(name == "Thomas" && age == 42) || (name == "Lance" && surname == "Armstrong")';
    const FILTER_3 = 'LIKE(name, "%thomas%", true) || age IN arr';

    const FILTER_A = '(d.name == "Thomas" && d.age == 42) || d.name == "Lance"';
    const FILTER_B = '(d.name == "Thomas" && d.age == 42) || (d.name == "Lance" && d.surname == "Armstrong")';
    const FILTER_C = 'LIKE(d.name, "%thomas%", true) || d.age IN arr';

    const result1 = findByFilterCriteria("col", FILTER_1, {
      prefixPropertyNames: true,
    }) as string;

    const result2 = findByFilterCriteria("col", FILTER_2, {
      prefixPropertyNames: true,
    }) as string;

    const result3 = findByFilterCriteria("col", FILTER_3, {
      prefixPropertyNames: true,
    }) as string;

    expect(result1.includes(FILTER_A)).toBeTruthy();
    expect(result2.includes(FILTER_B)).toBeTruthy();
    expect(result3.includes(FILTER_C)).toBeTruthy();

    const result4 = findByFilterCriteria("col", FILTER_A);
    const result5 = findByFilterCriteria("col", FILTER_B);
    const result6 = findByFilterCriteria("col", FILTER_C);

    expect(result4).toEqual(result1);
    expect(result5).toEqual(result2);
    expect(result6).toEqual(result3);

    expect(result4).toEqual('FOR d IN col FILTER ( (d.name == "Thomas" && d.age == 42) || d.name == "Lance" )');
    expect(result5).toEqual(
      'FOR d IN col FILTER ( (d.name == "Thomas" && d.age == 42) || (d.name == "Lance" && d.surname == "Armstrong") )'
    );
    expect(result6).toEqual('FOR d IN col FILTER ( LIKE(d.name, "%thomas%", true) || d.age IN arr )');

    const FILTER_D: ListOfFilters = {
      filters: ['name == "Thomas"', "d.age == 42", 'surname == "Armstrong"'],
      match: MatchType.ANY,
    };

    const FILTER_E: ListOfFilters = {
      filters: ['name == "Thomas"', "d.age == 42", 'surname == "Armstrong"'],
      match: MatchType.ALL,
    };

    const result7 = findByFilterCriteria("col", FILTER_D);
    expect(result7).toEqual('FOR d IN col FILTER ( name == "Thomas" OR d.age == 42 OR surname == "Armstrong" )');

    const result8 = findByFilterCriteria("col", FILTER_E);
    expect(result8).toEqual('FOR d IN col FILTER ( name == "Thomas" AND d.age == 42 AND surname == "Armstrong" )');
  });

  test("Fetch by key value", async () => {
    const result1 = fetchByKeyValue("col", { key: "username", value: "ABC" }, undefined, QueryType.STRING);
    expect(result1).toEqual('FOR d IN col FILTER d.username == "ABC" RETURN d');

    const result2 = fetchByKeyValue("col", { key: "age", value: 42 }, undefined, QueryType.STRING);
    expect(result2).toEqual("FOR d IN col FILTER d.age == 42 RETURN d");

    const result3 = fetchByKeyValue(
      "col",
      [
        { key: "username", value: "ABC" },
        { key: "age", value: 42 },
      ],
      undefined,
      QueryType.STRING
    );
    expect(result3).toEqual('FOR d IN col FILTER d.username == "ABC" || d.age == 42 RETURN d');

    const result4 = fetchByCompositeKeyValue(
      "col",
      [
        { key: "username", value: "ABC" },
        { key: "age", value: 42 },
      ],
      undefined,
      QueryType.STRING
    );
    expect(result4).toEqual('FOR d IN col FILTER d.username == "ABC" && d.age == 42 RETURN d');
  });

  test("Unique constraint query", async () => {
    const result1 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [{ unique: { key: "A", value: "Annie Apple" } }],
      },
      QueryType.STRING
    );

    expect(result1).toEqual('FOR d IN col FILTER d.A == "Annie Apple" RETURN d._key');

    const result2 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [{ unique: { key: "A", value: "Annie Apple" } }, { unique: { key: "B", value: "Bouncy Ben" } }],
      },
      QueryType.STRING
    );

    expect(result2).toEqual('FOR d IN col FILTER d.A == "Annie Apple" || d.B == "Bouncy Ben" RETURN d._key');

    const result3 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [
          {
            composite: [
              { key: "C", value: "Clever Cat" },
              { key: "D", value: "Dippy Duck" },
            ],
          },
        ],
      },
      QueryType.STRING
    );

    expect(result3).toEqual('FOR d IN col FILTER ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) RETURN d._key');

    const result4 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [
          {
            composite: [
              { key: "C", value: "Clever Cat" },
              { key: "D", value: "Dippy Duck" },
            ],
          },
          {
            composite: [
              { key: "E", value: "Eddy Elephant" },
              { key: "F", value: "Firefighter Fred" },
            ],
          },
        ],
      },
      QueryType.STRING
    );

    expect(result4).toEqual(
      'FOR d IN col FILTER ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) || ( d.E == "Eddy Elephant" && d.F == "Firefighter Fred" ) RETURN d._key'
    );

    const result5 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [
          { unique: { key: "A", value: "Annie Apple" } },
          {
            composite: [
              { key: "C", value: "Clever Cat" },
              { key: "D", value: "Dippy Duck" },
            ],
          },
        ],
      },
      QueryType.STRING
    );

    expect(result5).toEqual(
      'FOR d IN col FILTER d.A == "Annie Apple" || ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) RETURN d._key'
    );

    const result6 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [
          { unique: { key: "A", value: "Annie Apple" } },
          {
            composite: [
              { key: "C", value: "Clever Cat" },
              { key: "D", value: "Dippy Duck" },
            ],
          },
          { unique: { key: "B", value: "Bouncy Ben" } },
        ],
      },
      QueryType.STRING
    );

    expect(result6).toEqual(
      'FOR d IN col FILTER d.A == "Annie Apple" || ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) || d.B == "Bouncy Ben" RETURN d._key'
    );

    const result7 = uniqueConstraintQuery(
      {
        collection: "col",
        constraints: [
          {
            composite: [
              { key: "C", value: "Clever Cat" },
              { key: "D", value: "Dippy Duck" },
            ],
          },
          { unique: { key: "A", value: "Annie Apple" } },
          {
            composite: [
              { key: "E", value: "Eddy Elephant" },
              { key: "F", value: "Firefighter Fred" },
            ],
          },
          { unique: { key: "B", value: "Bouncy Ben" } },
        ],
      },
      QueryType.STRING
    );

    expect(result7).toEqual(
      'FOR d IN col FILTER ( d.C == "Clever Cat" && d.D == "Dippy Duck" ) || d.A == "Annie Apple" || ( d.E == "Eddy Elephant" && d.F == "Firefighter Fred" ) || d.B == "Bouncy Ben" RETURN d._key'
    );
  });
});

import { QueryType } from "../../src";
import { toUniqueConstraintQuery } from "../../src/queries";

describe("Queries", () => {
  test("Unique Constraint Validation Queries", async () => {
    const result1 = toUniqueConstraintQuery(
      {
        collection: "col",
        constraints: [{ unique: { key: "A", value: "Annie Apple" } }],
      },
      QueryType.STRING
    );

    expect(result1).toEqual('FOR d IN col FILTER d.A == "Annie Apple" RETURN d._key');

    const result2 = toUniqueConstraintQuery(
      {
        collection: "col",
        constraints: [{ unique: { key: "A", value: "Annie Apple" } }, { unique: { key: "B", value: "Bouncy Ben" } }],
      },
      QueryType.STRING
    );

    expect(result2).toEqual('FOR d IN col FILTER d.A == "Annie Apple" || d.B == "Bouncy Ben" RETURN d._key');

    const result3 = toUniqueConstraintQuery(
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

    const result4 = toUniqueConstraintQuery(
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

    const result5 = toUniqueConstraintQuery(
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

    const result6 = toUniqueConstraintQuery(
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

    const result7 = toUniqueConstraintQuery(
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

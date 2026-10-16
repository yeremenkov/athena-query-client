import { mockClient } from 'aws-sdk-client-mock';
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
  StatementType,
  StopQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { AthenaQueryClient } from '../src/athena-query-client';

const athenaMock = mockClient(AthenaClient);

const createClient = (overrides = {}) =>
  new AthenaQueryClient({
    ClientConfig: { region: 'eu-west-1' },
    Database: 'db',
    Catalog: 'catalog',
    PollIntervalMs: 1,
    ...overrides,
  });

const executionState = (
  State: QueryExecutionState,
  extra: { StatementType?: StatementType; StateChangeReason?: string } = {},
) => ({
  QueryExecution: {
    StatementType: extra.StatementType ?? StatementType.DML,
    Status: { State, StateChangeReason: extra.StateChangeReason },
  },
});

const columns = (...names: string[]) => ({
  ColumnInfo: names.map((Name) => ({ Name, Type: 'varchar' })),
});

const row = (...values: (string | undefined)[]) => ({
  Data: values.map((VarCharValue) =>
    VarCharValue === undefined ? {} : { VarCharValue },
  ),
});

describe('AthenaQueryClient', () => {
  beforeEach(() => {
    athenaMock.reset();
    athenaMock
      .on(StartQueryExecutionCommand)
      .resolves({ QueryExecutionId: 'qid' });
  });

  it('maps SELECT results to objects, skipping header row', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: columns('id', 'name'),
        Rows: [row('id', 'name'), row('1', 'Audi'), row('2', undefined)],
      },
    });

    await expect(createClient().query('SELECT 1')).resolves.toEqual([
      { id: '1', name: 'Audi' },
      { id: '2', name: '' },
    ]);

    const [start] = athenaMock.commandCalls(StartQueryExecutionCommand);
    expect(start.args[0].input).toMatchObject({
      QueryString: 'SELECT 1',
      QueryExecutionContext: { Database: 'db', Catalog: 'catalog' },
      WorkGroup: 'primary',
    });
  });

  it('returns rows with execution statistics from queryWithStats', async () => {
    athenaMock.on(GetQueryExecutionCommand).resolves({
      QueryExecution: {
        StatementType: StatementType.DML,
        Status: { State: QueryExecutionState.SUCCEEDED },
        Statistics: {
          DataScannedInBytes: 1024,
          EngineExecutionTimeInMillis: 120,
          TotalExecutionTimeInMillis: 150,
          ResultReuseInformation: { ReusedPreviousResult: false },
        },
      },
    });
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: columns('id'),
        Rows: [row('id'), row('1')],
      },
    });

    await expect(createClient().queryWithStats('SELECT id')).resolves.toEqual({
      rows: [{ id: '1' }],
      stats: {
        queryExecutionId: 'qid',
        dataScannedInBytes: 1024,
        engineExecutionTimeInMillis: 120,
        totalExecutionTimeInMillis: 150,
        reusedPreviousResult: false,
      },
    });
  });

  it('returns rows typed with the given generic', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: columns('id'),
        Rows: [row('id'), row('1')],
      },
    });

    const rows = await createClient().query<{ id: string }>('SELECT id');
    const ids: string[] = rows.map((r) => r.id);
    expect(ids).toEqual(['1']);
  });

  it('passes params as ExecutionParameters', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: { ResultSetMetadata: columns('id'), Rows: [row('id')] },
    });

    const client = createClient();
    await client.query('SELECT * FROM t WHERE id = ? AND name = ?', [
      '1',
      "'Audi'",
    ]);
    await client.query('SELECT 1');

    const [withParams, withoutParams] = athenaMock.commandCalls(
      StartQueryExecutionCommand,
    );
    expect(withParams.args[0].input.ExecutionParameters).toEqual([
      '1',
      "'Audi'",
    ]);
    expect(withoutParams.args[0].input).not.toHaveProperty(
      'ExecutionParameters',
    );
  });

  it('defaults Catalog to AwsDataCatalog', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: { ResultSetMetadata: columns('id'), Rows: [row('id')] },
    });

    await createClient({ Catalog: undefined }).query('SELECT 1');

    const [start] = athenaMock.commandCalls(StartQueryExecutionCommand);
    expect(start.args[0].input.QueryExecutionContext).toEqual({
      Database: 'db',
      Catalog: 'AwsDataCatalog',
    });
  });

  it('uses an injected AthenaClient instead of creating one', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: { ResultSetMetadata: columns('id'), Rows: [row('id')] },
    });
    const client = new AthenaClient({ region: 'us-east-1' });

    await new AthenaQueryClient({ Client: client, Database: 'db' }).query(
      'SELECT 1',
    );

    expect(athenaMock.call(0).thisValue).toBe(client);
  });

  it('returns null for NULL values when NullAsNull is enabled', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: columns('id', 'name'),
        Rows: [row('id', 'name'), row('1', undefined), row('2', '')],
      },
    });

    await expect(
      createClient({ NullAsNull: true }).query('SELECT 1'),
    ).resolves.toEqual([
      { id: '1', name: null },
      { id: '2', name: '' },
    ]);
  });

  it('converts values by column type when CoerceTypes is enabled', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: {
          ColumnInfo: [
            { Name: 'id', Type: 'integer' },
            { Name: 'big', Type: 'bigint' },
            { Name: 'price', Type: 'double' },
            { Name: 'exact', Type: 'decimal' },
            { Name: 'active', Type: 'boolean' },
            { Name: 'name', Type: 'varchar' },
            { Name: 'note', Type: 'varchar' },
          ],
        },
        Rows: [
          row('id', 'big', 'price', 'exact', 'active', 'name', 'note'),
          row('1', '9000000000', '9.5', '10.25', 'true', 'Audi', undefined),
          row('2', '0', '0', '0.10', 'false', '42', undefined),
        ],
      },
    });

    await expect(
      createClient({ CoerceTypes: true, NullAsNull: true }).query('SELECT 1'),
    ).resolves.toEqual([
      {
        id: 1,
        big: 9000000000,
        price: 9.5,
        exact: '10.25',
        active: true,
        name: 'Audi',
        note: null,
      },
      {
        id: 2,
        big: 0,
        price: 0,
        exact: '0.10',
        active: false,
        name: '42',
        note: null,
      },
    ]);
  });

  it('fetches all result pages', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock
      .on(GetQueryResultsCommand, {
        QueryExecutionId: 'qid',
        NextToken: undefined,
      })
      .resolves({
        NextToken: 'page2',
        ResultSet: {
          ResultSetMetadata: columns('id'),
          Rows: [row('id'), row('1')],
        },
      })
      .on(GetQueryResultsCommand, {
        QueryExecutionId: 'qid',
        NextToken: 'page2',
      })
      .resolves({
        ResultSet: { ResultSetMetadata: columns('id'), Rows: [row('2')] },
      });

    await expect(createClient().query('SELECT id')).resolves.toEqual([
      { id: '1' },
      { id: '2' },
    ]);
    expect(athenaMock.commandCalls(GetQueryResultsCommand)).toHaveLength(2);
  });

  it('returns an empty array when there are no rows', async () => {
    athenaMock.on(GetQueryExecutionCommand).resolves(
      executionState(QueryExecutionState.SUCCEEDED, {
        StatementType: StatementType.DDL,
      }),
    );
    athenaMock
      .on(GetQueryResultsCommand)
      .resolves({ ResultSet: { ResultSetMetadata: columns(), Rows: [] } });

    await expect(createClient().query('CREATE TABLE t')).resolves.toEqual([]);
  });

  it('keeps the first row for DDL results without a header row', async () => {
    athenaMock.on(GetQueryExecutionCommand).resolves(
      executionState(QueryExecutionState.SUCCEEDED, {
        StatementType: StatementType.DDL,
      }),
    );
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: {
        ResultSetMetadata: columns('tab_name'),
        Rows: [row('cars'), row('brands')],
      },
    });

    await expect(createClient().query('SHOW TABLES')).resolves.toEqual([
      { tab_name: 'cars' },
      { tab_name: 'brands' },
    ]);
  });

  it('polls while the query is queued or running', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolvesOnce(executionState(QueryExecutionState.QUEUED))
      .resolvesOnce(executionState(QueryExecutionState.RUNNING))
      .resolves(executionState(QueryExecutionState.SUCCEEDED));
    athenaMock.on(GetQueryResultsCommand).resolves({
      ResultSet: { ResultSetMetadata: columns('id'), Rows: [row('id')] },
    });

    await expect(createClient().query('SELECT id')).resolves.toEqual([]);
    expect(athenaMock.commandCalls(GetQueryExecutionCommand)).toHaveLength(3);
  });

  it('throws with the reason when the query fails', async () => {
    athenaMock.on(GetQueryExecutionCommand).resolves(
      executionState(QueryExecutionState.FAILED, {
        StateChangeReason: 'Syntax error',
      }),
    );

    await expect(createClient().query('SELEC')).rejects.toThrow(
      'Query failed: Syntax error',
    );
  });

  it('throws when the query is cancelled', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.CANCELLED));

    await expect(createClient().query('SELECT 1')).rejects.toThrow(
      'Query was cancelled',
    );
  });

  it('throws on an unexpected query state', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState('UNKNOWN' as QueryExecutionState));

    await expect(createClient().query('SELECT 1')).rejects.toThrow(
      'Unexpected query state: UNKNOWN',
    );
  });

  it('stops the query and throws when MaxWaitMs is exceeded', async () => {
    athenaMock
      .on(GetQueryExecutionCommand)
      .resolves(executionState(QueryExecutionState.RUNNING));
    athenaMock.on(StopQueryExecutionCommand).resolves({});

    await expect(
      createClient({ PollIntervalMs: 5, MaxWaitMs: 20 }).query('SELECT 1'),
    ).rejects.toThrow('Query timed out after 20ms');
    expect(athenaMock.commandCalls(StopQueryExecutionCommand)).toHaveLength(1);
    expect(
      athenaMock.commandCalls(StopQueryExecutionCommand)[0].args[0].input,
    ).toEqual({ QueryExecutionId: 'qid' });
  });
});

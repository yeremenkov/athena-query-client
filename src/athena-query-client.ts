import { setTimeout } from 'node:timers/promises';
import {
  AthenaClient,
  AthenaClientConfig,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  StopQueryExecutionCommand,
  QueryExecution,
  QueryExecutionState,
  GetQueryResultsCommand,
  ResultSetMetadata,
  Row,
  StatementType,
} from '@aws-sdk/client-athena';

export interface ResultReuseConfiguration {
  ResultReuseByAgeConfiguration: {
    Enabled: boolean;
    MaxAgeInMinutes?: number;
  };
}

export interface AthenaQueryClientConfig {
  ClientConfig: AthenaClientConfig;
  Database: string;
  Catalog: string;
  WorkGroup?: string;
  ResultReuseConfiguration?: ResultReuseConfiguration;
  PollIntervalMs?: number;
  MaxWaitMs?: number;
}

export interface QueryStatistics {
  queryExecutionId: string;
  dataScannedInBytes?: number;
  engineExecutionTimeInMillis?: number;
  totalExecutionTimeInMillis?: number;
  reusedPreviousResult?: boolean;
}

export interface QueryResultWithStats<T = Record<string, any>> {
  rows: T[];
  stats: QueryStatistics;
}

export class AthenaQueryClient {
  public database: string;
  private client: AthenaClient;
  private catalog: string;
  private workGroup: string = 'primary';
  private resultReuseConfiguration: ResultReuseConfiguration = {
    ResultReuseByAgeConfiguration: {
      Enabled: true,
      MaxAgeInMinutes: 60,
    },
  };
  private pollIntervalMs: number = 1000;
  private maxWaitMs?: number;

  constructor(config: AthenaQueryClientConfig) {
    this.client = new AthenaClient(config.ClientConfig);
    this.database = config.Database;
    this.catalog = config.Catalog;

    if (config.WorkGroup) {
      this.workGroup = config.WorkGroup;
    }

    if (config.ResultReuseConfiguration) {
      this.resultReuseConfiguration = config.ResultReuseConfiguration;
    }

    if (config.PollIntervalMs !== undefined) {
      this.pollIntervalMs = config.PollIntervalMs;
    }

    if (config.MaxWaitMs !== undefined) {
      this.maxWaitMs = config.MaxWaitMs;
    }
  }

  /**
   * Get data from Athena and return it as properly formatted Array of objects
   * @param {String} sqlQuery The SQL query string, may contain ? placeholders
   * @param {Array} params Values for the ? placeholders, each one an SQL literal
   * @return {Array} Array of Objects, typed as T
   */
  async query<T = Record<string, any>>(
    sqlQuery: string,
    params?: string[],
  ): Promise<T[]> {
    const { rows } = await this.queryWithStats<T>(sqlQuery, params);
    return rows;
  }

  /**
   * Same as query, but also returns the execution statistics
   * (data scanned, execution time, result reuse)
   * @param {String} sqlQuery The SQL query string, may contain ? placeholders
   * @param {Array} params Values for the ? placeholders, each one an SQL literal
   * @return {Object} Rows and statistics of the query execution
   */
  async queryWithStats<T = Record<string, any>>(
    sqlQuery: string,
    params?: string[],
  ): Promise<QueryResultWithStats<T>> {
    const queryExecutionInput = {
      QueryString: sqlQuery,
      QueryExecutionContext: {
        Database: this.database,
        Catalog: this.catalog,
      },
      WorkGroup: this.workGroup,
      ResultReuseConfiguration: this.resultReuseConfiguration,
      ...(params?.length ? { ExecutionParameters: params } : {}),
    };

    const { QueryExecutionId } = await this.client.send(
      new StartQueryExecutionCommand(queryExecutionInput),
    );

    if (!QueryExecutionId) {
      throw new Error('Athena did not return a QueryExecutionId');
    }

    return this.waitForQueryAndGetData<T>(QueryExecutionId);
  }

  /**
   * Poll query execution state every pollIntervalMs while it's "QUEUED" or "RUNNING",
   * then get the data once the state is "SUCCEEDED".
   * If maxWaitMs is set and exceeded, the query is stopped and an error is thrown.
   * @param {String} QueryExecutionId Id of a query which we sent to Athena
   * @return {Object} Rows and statistics of the query execution
   */
  private async waitForQueryAndGetData<T>(
    QueryExecutionId: string,
  ): Promise<QueryResultWithStats<T>> {
    const startedAt = Date.now();

    while (true) {
      const response = await this.client.send(
        new GetQueryExecutionCommand({ QueryExecutionId }),
      );
      const execution: QueryExecution = response.QueryExecution ?? {};
      const { Status, StatementType: statementType, Statistics } = execution;
      const state = Status?.State;

      if (state === QueryExecutionState.SUCCEEDED) {
        const rows = await this.getQueryResults(
          QueryExecutionId,
          statementType,
        );
        return {
          // Values are mapped at runtime; T is the caller's description of the row shape
          rows: rows as unknown as T[],
          stats: {
            queryExecutionId: QueryExecutionId,
            dataScannedInBytes: Statistics?.DataScannedInBytes,
            engineExecutionTimeInMillis:
              Statistics?.EngineExecutionTimeInMillis,
            totalExecutionTimeInMillis: Statistics?.TotalExecutionTimeInMillis,
            reusedPreviousResult:
              Statistics?.ResultReuseInformation?.ReusedPreviousResult,
          },
        };
      } else if (state === QueryExecutionState.FAILED) {
        throw new Error(`Query failed: ${Status?.StateChangeReason}`);
      } else if (state === QueryExecutionState.CANCELLED) {
        throw new Error('Query was cancelled');
      } else if (
        state !== QueryExecutionState.QUEUED &&
        state !== QueryExecutionState.RUNNING
      ) {
        throw new Error(`Unexpected query state: ${state}`);
      }

      if (
        this.maxWaitMs !== undefined &&
        Date.now() - startedAt >= this.maxWaitMs
      ) {
        await this.client.send(
          new StopQueryExecutionCommand({ QueryExecutionId }),
        );
        throw new Error(`Query timed out after ${this.maxWaitMs}ms`);
      }

      await setTimeout(this.pollIntervalMs);
    }
  }

  /**
   * Get all pages of the query execution result
   * @param {String} QueryExecutionId Id of a query which we sent to Athena
   * @param {String} statementType Type of the executed statement (DML, DDL, UTILITY)
   * @return {Array} Array of Objects
   */
  private async getQueryResults(
    QueryExecutionId: string,
    statementType?: string,
  ) {
    const rows: Row[] = [];
    let metadata: ResultSetMetadata | undefined;
    let nextToken: string | undefined;

    do {
      const response = await this.client.send(
        new GetQueryResultsCommand({ QueryExecutionId, NextToken: nextToken }),
      );
      metadata = metadata ?? response.ResultSet?.ResultSetMetadata;
      rows.push(...(response.ResultSet?.Rows ?? []));
      nextToken = response.NextToken;
    } while (nextToken);

    // Only SELECT (DML) results include a header row as the first row;
    // if the statement type is unknown, keep the previous behavior and skip it
    const hasHeaderRow = !statementType || statementType === StatementType.DML;
    return this.mapData(metadata, hasHeaderRow ? rows.slice(1) : rows);
  }

  /**
   * Map rows of values returned from Athena into an array of key/value objects.
   * @param {Object} metadata Result set metadata with column info
   * @param {Array} rows Data rows returned from Athena (without header row)
   * @return {Array} Array of Objects
   */
  private mapData(metadata: ResultSetMetadata | undefined, rows: Row[]) {
    const columns = (metadata?.ColumnInfo ?? []).map(
      (column, i) => column.Name ?? `_col${i}`,
    );

    return rows.map((row) => {
      const mappedObject: Record<string, string> = {};
      (row.Data ?? []).forEach((value, i) => {
        mappedObject[columns[i]] = value.VarCharValue || '';
      });
      return mappedObject;
    });
  }
}

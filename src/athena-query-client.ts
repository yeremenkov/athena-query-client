import {
  AthenaClient,
  AthenaClientConfig,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  QueryExecutionState,
  GetQueryResultsCommand,
} from '@aws-sdk/client-athena';

interface AthenaQueryClientConfig {
  ClientConfig: AthenaClientConfig;
  Database: string;
  Catalog: string;
}

export class AthenaQueryClient {
  public options: any;
  private client: AthenaClient;
  private database: string;
  private catalog: string;

  constructor(config: AthenaQueryClientConfig) {
    this.client = new AthenaClient(config.ClientConfig);
    this.database = config.Database;
    this.catalog = config.Catalog;
    this.options = {
      type: 'mysql',
      database: config.Database,
    };
  }

  /**
   * helper to escape user input to be savely used in queries
   * @param {String} raw input to be used in SQL query string
   * @return {String} the escaped user input
   */
  sqlSaveEscapeString(raw: string): string {
    return raw.replace(/[\\%_]/g, '\\$&');
  }

  /**
   * Get data from Athena and rerutn it as proper formatted Array of objects
   * @param {String} sqlQuery The SQL query string
   * @return {Array} Array of Objects
   */
  async query(sqlQuery: string): Promise<any> {
    const queryExecutionInput = {
      QueryString: sqlQuery,
      QueryExecutionContext: {
        Database: this.database,
        Catalog: this.catalog,
      },
      WorkGroup: 'primary',
      ResultReuseConfiguration: {
        ResultReuseByAgeConfiguration: {
          Enabled: true,
          MaxAgeInMinutes: 60,
        },
      },
    };

    const { QueryExecutionId } = await this.client.send(
      new StartQueryExecutionCommand(queryExecutionInput),
    );

    const response =
      await this.checkQueryExequtionStateAndGetData(QueryExecutionId);
    return response;
  }

  /**
   * Check query exeqution state if it's equal "QUEUED" or "RUNNING"
   * then afte 1 second the function call itself again recursively
   * until the state is "SUCCEEDED" and after it we get the data
   * @param {String} QueryExecutionId Id of a query which we sent to Athena
   * @return {Array} Array of Objects
   */
  private async checkQueryExequtionStateAndGetData(QueryExecutionId: string) {
    const command = new GetQueryExecutionCommand({ QueryExecutionId });
    const response = await this.client.send(command);
    const state = response.QueryExecution.Status.State;

    if (
      state === QueryExecutionState.QUEUED ||
      state === QueryExecutionState.RUNNING
    ) {
      await this.timeout(1000);
      return await this.checkQueryExequtionStateAndGetData(QueryExecutionId);
    } else if (state === QueryExecutionState.SUCCEEDED) {
      return await this.getQueryResults(QueryExecutionId);
    } else if (state === QueryExecutionState.FAILED) {
      throw new Error(
        `Query failed: ${response.QueryExecution.Status.StateChangeReason}`,
      );
    } else if (state === QueryExecutionState.CANCELLED) {
      throw new Error('Query was cancelled');
    }
  }

  /**
   * Get result of query exeqution
   * @param {String} QueryExecutionId Id of a query which we sent to Athena
   * @return {Array} Array of Objects
   */
  private async getQueryResults(QueryExecutionId: string) {
    const getQueryResultsCommand = new GetQueryResultsCommand({
      QueryExecutionId,
    });
    const response = await this.client.send(getQueryResultsCommand);

    return this.mapData(response.ResultSet);
  }

  /**
   * The function map data returned from Athena as rows of values in the array of key/value objects.
   * @param {Array} data Data of rows returned from Athena
   * @return {Array} Array of Objects
   */
  private mapData(data: any) {
    const mappedData = [];

    const columns = data.Rows[0].Data.map((column) => {
      return column.VarCharValue;
    });

    data.Rows.forEach((item, i) => {
      if (i === 0) {
        return;
      }

      const mappedObject = {};
      item.Data.forEach((value, i) => {
        if (value.VarCharValue) {
          mappedObject[columns[i]] = value.VarCharValue;
        } else {
          mappedObject[columns[i]] = '';
        }
      });

      mappedData.push(mappedObject);
    });

    return mappedData;
  }

  /**
   * Simple helper timeout function uses in checkQueryExequtionStateAndGetData function
   * @param {number} msTime Time in miliseconds
   * @return {Promise} Promise
   */
  private timeout(msTime: number) {
    return new Promise((resolve) => setTimeout(resolve, msTime));
  }
}

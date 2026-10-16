# Athena Query Client #

[![CI](https://github.com/yeremenkov/athena-query-client/actions/workflows/ci.yml/badge.svg)](https://github.com/yeremenkov/athena-query-client/actions/workflows/ci.yml)

The Athena Query Client is a simple package that provides a method to retrieve data from Amazon Athena by merely passing an SQL query as the single parameter of the method.

## AthenaQueryClient constructor params

- **ClientConfig:** Configuration settings for the AWS Athena client
  - **region:** AWS geographical region, for example 'eu-west-1'
- **Catalog:** AWS Athena data source catalog name
- **Database:** AWS Athena database name. The database must exist in the catalog.
- **WorkGroup:** The name of the workgroup in which the query is being started. This is optional param, by default set to 'primary'.
- **ResultReuseConfiguration:** Specifies the query result reuse behavior for the query, how the query results are cached or reused. This is optional param, predifined by default.
  - **ResultReuseByAgeConfiguration:** Specifies whether previous query results are reused, and if so, their maximum age.
    - **Enabled:** A boolean value (true/false) that toggles this feature on or off. True if previous query results can be reused when the query is run; otherwise, false. The default is true.
    - **MaxAgeInMinutes:** Specifies, in minutes, the maximum age of a previous query result that Athena should consider for reuse. The default is 60.
- **PollIntervalMs:** How often, in milliseconds, the query execution state is checked. This is optional param, by default set to 1000.
- **MaxWaitMs:** Maximum time, in milliseconds, to wait for the query to finish. When exceeded, the query is stopped and an error is thrown. This is optional param, by default there is no limit.

Results are paginated automatically, so all rows are returned regardless of size. NULL values are returned as empty strings.

## Usage

```js
import { AthenaQueryClient } from 'athena-query-client';

/*
    The ResultReuseConfiguration and WorkGroup parameters is optional; it is set up by default, but you have the option to overwrite it.
*/
const athenaQueryClient = new AthenaQueryClient({
    ClientConfig: { region: 'eu-west-1' },
    Database: 'all_cars',
    Catalog: 'Databases',
    WorkGroup: 'primary',
    ResultReuseConfiguration: {
      ResultReuseByAgeConfiguration: {
        Enabled: true,
        MaxAgeInMinutes: 60,
      }
    },
    PollIntervalMs: 1000,
    MaxWaitMs: 300000,
  });

const data = await athenaQueryClient.query('SELECT * FROM cars_brands LIMIT 20');
```

### Query statistics

`queryWithStats` returns the same rows together with the execution statistics:

```js
const { rows, stats } = await athenaQueryClient.queryWithStats(
  'SELECT * FROM cars_brands LIMIT 20',
);
// stats: { queryExecutionId, dataScannedInBytes, engineExecutionTimeInMillis,
//          totalExecutionTimeInMillis, reusedPreviousResult }
```

## Releasing

Releases are published to npm automatically by GitHub Actions when a `vX.Y.Z` tag is pushed:

```sh
npm version patch   # or minor / major — bumps package.json, commits and tags
git push --follow-tags
```

The workflow checks that the tag matches the `package.json` version, runs lint/tests/build, publishes to npm (via Trusted Publishing, with provenance) and creates a GitHub Release.

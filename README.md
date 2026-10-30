# Athena Query Client #

[![CI](https://github.com/yeremenkov/athena-query-client/actions/workflows/ci.yml/badge.svg)](https://github.com/yeremenkov/athena-query-client/actions/workflows/ci.yml)

The Athena Query Client is a simple package that provides a method to retrieve data from Amazon Athena by merely passing an SQL query as the single parameter of the method.

## Installation

`@aws-sdk/client-athena` is a peer dependency, so your app shares a single copy of the AWS SDK:

```sh
npm install athena-query-client @aws-sdk/client-athena
```

## AthenaQueryClient constructor params

- **ClientConfig:** Configuration settings for the AWS Athena client. Optional; without it the SDK picks up region and credentials from the environment.
  - **region:** AWS geographical region, for example 'eu-west-1'
- **Client:** An existing `AthenaClient` instance to use instead of creating one from `ClientConfig`. Optional; useful to share a client or to mock it in tests.
- **Catalog:** AWS Athena data source catalog name. Optional, defaults to 'AwsDataCatalog'.
- **Database:** AWS Athena database name. The database must exist in the catalog.
- **WorkGroup:** The name of the workgroup in which the query is being started. Optional, defaults to 'primary'.
- **ResultReuseConfiguration:** Specifies the query result reuse behavior for the query, how the query results are cached or reused. Optional, predefined by default.
  - **ResultReuseByAgeConfiguration:** Specifies whether previous query results are reused, and if so, their maximum age.
    - **Enabled:** A boolean value that toggles this feature on or off. True if previous query results can be reused when the query is run; otherwise, false. The default is true.
    - **MaxAgeInMinutes:** Specifies, in minutes, the maximum age of a previous query result that Athena should consider for reuse. The default is 60.
- **PollIntervalMs:** How often, in milliseconds, the query execution state is checked. Optional, defaults to 1000. Must be a positive number.
- **NullAsNull:** When true, NULL values are returned as `null` instead of empty strings. Optional, defaults to false.
- **CoerceTypes:** When true, values are converted using the column type: `tinyint`, `smallint`, `integer`, `bigint`, `float`, `real` and `double` become numbers, `boolean` becomes `true`/`false`. Other types, including `decimal`, stay strings. Note that `bigint` values above 2^53 lose precision. Optional, defaults to false.
- **MaxWaitMs:** Maximum time, in milliseconds, to wait for the query to finish. When exceeded, the query is stopped and an error is thrown. Optional, no limit by default.

Results are paginated automatically, so all rows are returned regardless of size. NULL values are returned as empty strings unless `NullAsNull` is enabled.

## Usage

```js
import { AthenaQueryClient } from 'athena-query-client';

/*
    The WorkGroup, ResultReuseConfiguration, PollIntervalMs and MaxWaitMs parameters are optional;
    they have defaults, but you can override them.
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

### Parameterized queries

Pass values for `?` placeholders as the second argument. They are sent as Athena `ExecutionParameters`,
so user input is not concatenated into the SQL string. Each value is read as an SQL literal,
so string values must be wrapped in single quotes:

```js
const data = await athenaQueryClient.query(
  'SELECT * FROM cars_brands WHERE country = ? AND founded > ?',
  ["'Germany'", '1900'],
);
```

### Typed rows

`query` and `queryWithStats` accept a generic describing the row shape (defaults to `Record<string, any>`):

```ts
interface CarBrand {
  id: string;
  name: string;
}

const brands = await athenaQueryClient.query<CarBrand>('SELECT id, name FROM cars_brands');
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

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the project, run the tests and open a pull request.

## Releasing

Releases are published to npm automatically by GitHub Actions when a `vX.Y.Z` tag is pushed.
Changes are listed under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) as they are made; `npm version`
turns that section into the new version's entry:

```sh
npm version patch   # or minor / major — bumps package.json, commits and tags
git push --follow-tags
```

The workflow checks that the tag matches the `package.json` version, runs lint/tests/build, publishes to npm (via Trusted Publishing, with provenance) and creates a GitHub Release from the CHANGELOG entry.

## License

MIT. Versions up to 1.1.0 were released under GPL-3.0-only.

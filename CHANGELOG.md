# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking

- `@aws-sdk/client-athena` is now a peer dependency. npm 7+ installs it automatically; with other package managers install it alongside: `npm install athena-query-client @aws-sdk/client-athena`.
- The package now has an `exports` map, so deep imports such as `athena-query-client/dist/...` no longer resolve. Import from `athena-query-client` instead.

### Added

- `queryWithStats(sql, params?)` returns `{ rows, stats }` with the query execution id, data scanned, execution times and whether a previous result was reused.
- Parameterized queries: `query(sql, params)` sends values for `?` placeholders as Athena `ExecutionParameters`.
- `query<T>()` and `queryWithStats<T>()` accept a generic describing the row shape.
- `Client` option to pass an existing `AthenaClient` instance; `ClientConfig` is now optional.
- `NullAsNull` option to return `null` instead of `''` for NULL values.
- `CoerceTypes` option to convert numeric and boolean columns to JS numbers and booleans.
- ES module build alongside CommonJS.
- Exported `AthenaQueryClientConfig`, `ResultReuseConfiguration`, `QueryStatistics` and `QueryResultWithStats` types.

### Changed

- License changed from GPL-3.0-only to MIT.
- `Catalog` is optional and defaults to `AwsDataCatalog`.
- Type declarations now include JSDoc comments.
- The source is compiled with strict TypeScript; a missing `QueryExecutionId` from Athena now throws a clear error.

## [1.1.0] - 2026-10-16

### Added

- `PollIntervalMs` option to set how often the query state is checked (default 1000 ms).
- `MaxWaitMs` option to limit how long to wait for a query; on timeout the query is stopped and an error is thrown.
- Test suite, CI workflow and automated npm releases.

### Fixed

- Results larger than 1000 rows were truncated; all result pages are now fetched.
- Queries returning no rows crashed; they now return an empty array.
- DDL results such as `SHOW TABLES` lost their first row, which was treated as a header.
- An unexpected query state returned `undefined`; it now throws an error.

## [1.0.2] - 2024-01-14

### Added

- `WorkGroup` option (defaults to `primary`).
- `ResultReuseConfiguration` option; result reuse was previously hardcoded.

## [1.0.1] - 2024-01-05

### Changed

- Removed unused internal method and properties. This version was later unpublished from npm.

## [1.0.0] - 2024-01-03

### Added

- Initial release: `AthenaQueryClient.query(sql)` runs a query on Amazon Athena and returns the rows as an array of objects.

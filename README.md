# Athena Query Client #

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
    }
  });

const data = await athenaQueryClient.query('SELECT * FROM cars_brands LIMIT 20');
```
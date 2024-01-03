# Athena Query Client #

The Athena Query Client is a simple package that provides a method to retrieve data from Amazon Athena by merely passing an SQL query as the single parameter of the method.

## Usage

```js
import { AthenaQueryClient } from 'athena-query-client';

const athenaQueryClient = new AthenaQueryClient({
    ClientConfig: { region: 'eu-west-1' },
    Database: 'all_cars',
    Catalog: 'Databases',
  });

const data = await athenaQueryClient.query('SELECT * FROM cars_brands LIMIT 20');
```
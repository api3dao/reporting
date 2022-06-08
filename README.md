# Reporting Tools

## Setup

To start using these tools you will need to:

1. Create a `.env` file containing your database credentials. Please see `.env.example` for the required credentials.
2. Run `yarn install` to install the dependencies.

## Reports

You can produce reports using the scripts defined in `package.json`.

For example, `yarn gas-all` will produce a report of total gas fees for each deployed DapiServer for the whole history.

## Options
### Date Options
1. `start`: (optional) Start date in the format of `day-month-year`,
2. `end`: (optional) End date in the format of `day-month-year`

`yarn gas-all --start=20-5-2022 --end=1-6-2022`

### Custom Queries

You can do a custom query to the database using the following format: `yarn report --query="custom:<SQL QUERY>"`.

For example, `yarn report --query="custom:SELECT * FROM dapi_events;" --output=html` will produce a report with with all
rows from the `dapi_events` table.

### Exports

You can find the reports in the `./exports` folder.

# Reporting Tools

## Setup

To start using these tools you will need to:

1. Create a `.env` file containing your database credentials. Please see `.env.example` for the required credentials.
2. Either run the latest version of the application using docker (see "Run using Docker") or
3. Run this application directly from this repository: run `yarn install` to install the dependencies.

## Run Using Docker

As a convenience, all PRs for this repository are build as a docker image and pushed to Docker Hub. All images are
tagged as "latest", as this repository is for internal use and low traffic.

You can run the below commands by affixing them to this docker command:

```shell
docker run -ti --rm --env-file .env api3/reporting
```

for example:

```shell
docker run -ti --rm --env-file .env api3/reporting yarn gas-all
```

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

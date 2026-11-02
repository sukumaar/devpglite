# devpglite

[![Build and publish](https://github.com/sukumaar/devpglite/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/sukumaar/devpglite/actions/workflows/npm-publish.yml)
[![npm version](https://img.shields.io/npm/v/devpglite)](https://www.npmjs.com/package/devpglite)

A local PostgreSQL-compatible database for development and tests, powered by
[PGlite](https://github.com/electric-sql/pglite). The goal is to let apps connect through a database URL without installing
PostgreSQL or running Docker.

Requires Node.js 24 or newer and npm.

## Installation

Run without installing globally:

```sh
npx devpglite start
```

Or install globally and run the CLI:

```sh
npm install --global devpglite
devpglite start
```

## Usage

### Connect to the database

The server listens on `localhost:51214` and stores data in `~/.devpglite`.
Press Ctrl+C to stop it. SIGINT and SIGTERM close the database cleanly.

Set your app's database URL to:

```text
postgresql://postgres:postgres@localhost:51214/postgres?sslmode=disable
```

To check the connection with `psql`:

```sh
psql 'postgresql://postgres:postgres@localhost:51214/postgres?sslmode=disable' -c 'SELECT current_database();'
```

The result should be `postgres`.

### Configure the server

Set environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `51214` | TCP port, from 1 to 65535 |
| `PGLITE_DATA_DIR` | `~/.devpglite` | Where database files are saved |
| `MAX_CONNECTIONS` | `10` | Maximum connected clients; a positive integer |

Unset or empty values use defaults. Relative paths start from the current
directory. The host is always `localhost`.

```sh
PORT=5433 PGLITE_DATA_DIR=./local-data MAX_CONNECTIONS=20 npx devpglite start
```

The matching CLI options override environment variables:

```sh
npx devpglite start --port 5433 --data-dir ./local-data --max-connections 20
```

Change the port in your database URL to match. Add custom data directories to
`.gitignore`.

### Load initial data

Use `--init` to load SQL before the server accepts connections. The SQL runs in
one transaction for a new database; existing databases skip it on restart.

```sh
npx devpglite start --init ./initial.sql
```

Use plain SQL, without psql commands or your own `BEGIN`/`COMMIT`. If loading
fails, fix the file and restart with `--clean`.

### Start fresh

```sh
npx devpglite start --clean
npx devpglite start --clean --init ./initial.sql
```

`--clean` permanently deletes everything in the configured data directory,
including extra files. Stop any server using that directory first. Cleanup
refuses symlinks, protected directories, and nonempty directories without
`PG_VERSION`. A missing SQL file fails before deletion.

### Limits

- Up to 10 clients connect by default. Keep combined app pool sizes within the
  configured limit.
- SSL is disabled. URL credentials are placeholders and do not protect access.
- Use one server per data directory. This is for development and testing.

PGlite has one underlying database connection shared by clients, so queries run
sequentially. Keep transactions short. Use PostgreSQL for tests requiring
independent sessions or parallel queries. See the [socket package
documentation](https://github.com/electric-sql/pglite/blob/main/packages/pglite-socket/README.md).

## Development

Clone the repository, then install dependencies and start the source version:

```sh
npm install
npm start
```


### Project structure

```text
src/
  cli.ts           # commands and generated help
  constants.ts     # shared defaults, options, and interfaces
  config.ts        # read and validate settings
  database.ts      # clean storage and load initial data
  logger.ts        # shared terminal logger
  server.ts        # start and stop the server
test/
  constants.ts     # test settings, SQL, and expected results
  cli.test.ts      # help and argument checks
  config.test.ts   # default and custom storage paths
  logging.test.ts  # useful status messages and errors
  database.test.ts # safe directory cleanup
  server.test.ts   # data loading, restarts, and shutdown
  helpers/         # test setup and cleanup
```

```sh
npm test
npm run typecheck
npm run build
```

### Testing mental model

```text
Vitest
  -> supplies temporary environment and storage
  -> starts application logic inside the test process
  -> creates a real PGlite database
  -> replaces only the TCP listener with a fake
  -> verifies behavior, then restores all test state
```

Tests do not launch the CLI executable or a child process. Application code
reads the test-controlled `process.env` because it runs inside Vitest's Node
process. PGlite is real and persists into a temporary directory; only network
transport is simulated.

Both source and tests are TypeScript. Vitest runs tests directly. Build output
goes in `dist/`, which is ignored by Git.

## Publish

```sh
npm pack --dry-run
npm publish
```

Both commands build automatically. The package contains `dist/`, the README,
and package metadata. The CLI entry is `dist/cli.js`.

Publishing requires an npm account with access to the package name. Change
`name` in `package.json` if needed. Users can then run `npx devpglite start`, or
install it with `npm install -g devpglite` and run `devpglite start`.

Use `devpglite --help` for options and `devpglite --version` for the version.

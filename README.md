# devpglite

A local PostgreSQL-compatible database for development and tests, powered by
[PGlite](https://github.com/electric-sql/pglite). The goal is to let apps connect through a database URL without installing
PostgreSQL or running Docker.

Requires Node.js 24 or newer and npm.

## Start

From this repository:

```sh
npm install
npm start
```

`npm run db` does the same thing. Once published to npm, you can also run
`npx devpglite start` without a global install.

The server listens on `localhost:51214`. The installed CLI saves data in
`~/.devpglite`, so it uses the same database from any folder. Source runs with
`npm start` or `npm run db` use `./.devpglite` through `.env.development`.
Press Ctrl+C to stop. SIGINT and SIGTERM stop the server and close the database.

[Signale](https://github.com/klaudiosinani/signale) logs startup, the data path,
cleanup, initial data loading, the connection URL, client connections, shutdown,
and errors to stderr. Client logs show the remote address and port.
SQL contents are not logged. Help and version output use stdout.

Set your app's database URL to:

```text
postgresql://postgres:postgres@localhost:51214/postgres?sslmode=disable
```

To check the connection with `psql`:

```sh
psql 'postgresql://postgres:postgres@localhost:51214/postgres?sslmode=disable' -c 'SELECT current_database();'
```

The result should be `postgres`.

## Settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `51214` | TCP port, from 1 to 65535 |
| `PGLITE_DATA_DIR` | `~/.devpglite` | Where database files are saved |
| `MAX_CONNECTIONS` | `10` | Maximum connected clients; a positive integer |

Unset or empty values use the defaults. For source runs, `.env.development`
provides a local path unless you set `PGLITE_DATA_DIR` yourself. Relative paths
start from the directory where you run the command. The host is always `localhost`.

```sh
PORT=5433 PGLITE_DATA_DIR=./local-data MAX_CONNECTIONS=20 npm start
```

Change the port in your database URL to match. Add custom data directories to
`.gitignore`.

## Load initial data

Use `--init` to create tables and load data from a SQL file before the server
accepts connections. For example, save this as `initial.sql`:

```sql
CREATE TABLE users (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO users VALUES (1, 'Alice');
```

```sh
npm start -- --init ./initial.sql
```

The SQL runs in one transaction when creating a database. Existing databases
skip it on restart. Use plain SQL, without psql commands such as `\i` or your
own `BEGIN`/`COMMIT`. If loading fails, fix the file and restart with `--clean`.

## Start fresh

```sh
npm start -- --clean
npm start -- --clean --init ./initial.sql
```

`--clean` permanently deletes everything in `PGLITE_DATA_DIR`, including extra
files, before creating a new database. By default, that means `~/.devpglite` for
the installed CLI or `./.devpglite` for source runs. Stop any server using that
directory first.

Cleanup refuses symlinks, the working directory, your home directory, their
parents, and nonempty directories without `PG_VERSION`. Missing or empty data
directories are allowed. A missing SQL file fails before any deletion.

With the published CLI, use `devpglite start --clean --init ./initial.sql`.
The extra `--` in npm commands passes the flags to devpglite.

## Limits

- Up to 10 clients can connect by default, including apps, workers, and database
  tools. Set `MAX_CONNECTIONS` to change the limit, and keep the combined pool
  sizes within it. Extra connections may fail with `connection reset by peer`.
- SSL is disabled. The URL credentials are placeholders and do not protect access.
- Use one server per data directory. This project is intended for development
  and testing.

PGlite has one underlying database connection. The socket package shares it
between clients and runs their queries sequentially. An open transaction can
make other clients wait, so keep transactions short. This does not provide
independent PostgreSQL sessions or parallel queries; use PostgreSQL itself for
tests that depend on those behaviors. See the
[socket package documentation](https://github.com/electric-sql/pglite/blob/main/packages/pglite-socket/README.md).

## Development

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

Tests use real PGlite databases and replace the TCP listener so they can run
where sockets are blocked. Each test gets its own temporary files and settings.
Both source and tests are TypeScript. Build output goes in `dist/`; compiled
tests go in `.test-dist/`. Both directories are ignored by Git.

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

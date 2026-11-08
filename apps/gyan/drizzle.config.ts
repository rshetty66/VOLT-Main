{
  "$schema": "./node_modules/@drizzle-team/brocli/dist/drizzle-config.schema.json",
  "dialect": "mysql",
  "schema": "./db/schema.ts",
  "out": "./db/migrations",
  "dbCredentials": {
    "url": "mysql://root@localhost:3306/gyan"
  },
  "verbose": true,
  "strict": true
}

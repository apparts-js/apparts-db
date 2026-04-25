# @apparts/db

Database abstraction layer for Node.js with support for multiple database engines. Currently supports **PostgreSQL**.

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [PostgreSQL Configuration](#postgresql-configuration)
- [API](#api)
  - [Database Connection (`DBS`)](#database-connection-dbs)
  - [Query](#query)
  - [Filters and Operators](#filters-and-operators)
- [Transactions](#transactions)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @apparts/db
```

You also need to install the driver for your database:

```bash
npm install pg
```

## Quick Start

```typescript
import { connect } from "@apparts/db";

const dbs = await connect({
  use: "postgresql",
  postgresql: {
    host: "localhost",
    port: 5432,
    user: "dbuser",
    pw: "dbpassword",
    db: "mydatabase",
  },
});

// Query a collection
const users = await dbs.collection("users").find({ active: true }).toArray();

await dbs.shutdown();
```

## Configuration

The `connect` function takes a config object specifying which database engine to use and its connection parameters.

```typescript
interface Config {
  use: "postgresql"; // Database engine to use
  postgresql: PGConfig;
}
```

### PostgreSQL Configuration

```typescript
interface PGConfig {
  host: string; // Database host
  port: number; // Database port
  user: string; // Username
  pw: string; // Password
  db: string; // Database name
  maxPoolSize: number; // Max pool size (default: 10)
  connectionTimeoutMillis: number; // Connection timeout (default: 0)
  idleTimeoutMillis: number; // Idle timeout (default: 10000)
  bigIntAsNumber: boolean; // Return BIGINT as number instead of string
  idsAsBigInt?: boolean; // Use BIGINT for auto-increment IDs
  logs?: "errors"; // Log mode: "errors" to log failed queries
  logParams?: boolean; // Include params in error logs
  arrayAsJSON?: boolean; // Store arrays as JSON strings
  poolConfig?: PoolConfig; // Additional pg.Pool config
}
```

> Note: `maxPoolSize`, `connectionTimeoutMillis`, `idleTimeoutMillis`, and `bigIntAsNumber` are required by the TypeScript interface but have runtime defaults of `10`, `0`, `10000`, and `false` respectively.

## API

### Database Connection (`DBS`)

```typescript
const dbs = await connect(config);
```

#### `collection(name: string): Query`

Returns a `Query` object for the given table/collection name.

#### `transaction<T>(fn: (t: Transaction) => Promise<T>): Promise<T>`

Executes a function within a database transaction. Automatically commits on success or rolls back on error.

```typescript
const result = await dbs.transaction(async (t) => {
  await t.collection("users").insert([{ name: "Alice" }]);
  await t.collection("orders").insert([{ userId: 1, total: 100 }]);
  return "success";
});
```

#### `raw<T>(query: string, params?: any[]): Promise<Result<T>>`

Execute a raw SQL query.

```typescript
const result = await dbs.raw("SELECT * FROM users WHERE active = $1", [true]);
```

#### `createCollection(name, indexes, fields, prefix?)`

Create a new table programmatically.

```typescript
await dbs.createCollection(
  "users",
  [
    { name: "id", key: ["id"] }, // Primary key
    { name: "email", unique: true }, // Unique constraint
    { name: "groupId", foreign: { table: "groups", field: "id" } }, // Foreign key
  ],
  [
    { name: "id", type: "serial", notNull: true },
    { name: "email", type: "text", notNull: true },
    { name: "groupId", type: "integer" },
    { name: "createdAt", type: "bigint" },
  ]
);
```

#### `shutdown(): Promise<void>`

Closes the database connection pool.

### Query

Query objects are created via `dbs.collection("tableName")`.

#### `find(params, limit?, offset?, order?): this`

Find rows matching the given parameters.

```typescript
// Simple equality
await dbs.collection("users").find({ role: "admin" }).toArray();

// With pagination and sorting
await dbs
  .collection("users")
  .find({ active: true }, 10, 0, [{ key: "createdAt", dir: "DESC" }])
  .toArray();

// Sort by JSONB path
await dbs
  .collection("users")
  .find({}, 10, 0, [{ key: "metadata", path: ["score"], dir: "DESC" }])
  .toArray();
```

#### `findById(id, limit?, offset?, order?): this`

Alias for `find`.

#### `findByIds(ids, limit?, offset?, order?): this`

Find rows where the specified fields match any value in the given arrays.

```typescript
await dbs
  .collection("users")
  .findByIds({ id: [1, 2, 3] })
  .toArray();
```

#### `toArray<T>(): Promise<T[]>`

Execute the query and return all matching rows.

#### `count(): Promise<number>`

Return the count of matching rows.

```typescript
const count = await dbs.collection("users").find({ active: true }).count();
```

#### `insert(content, returning?): Promise<Record<string, Id>[]>`

Insert one or more rows. If `returning` is omitted, it defaults to `["id"]`.

```typescript
const inserted = await dbs.collection("users").insert(
  [{ name: "Alice", email: "alice@example.com" }],
  ["id"] // Return the generated IDs
);
```

#### `update(filter, content): Promise<Result<T>>`

Update all rows matching the filter.

```typescript
await dbs.collection("users").update({ id: 1 }, { name: "Alice Updated" });
```

#### `updateOne(filter, content): Promise<Result<T>>`

Alias for `update`.

#### `remove(params): Promise<Result<T>>`

Delete rows matching the parameters.

```typescript
await dbs.collection("users").remove({ id: 1 });
```

#### `drop(): Promise<void>`

Drop the table.

### Filters and Operators

The `find` methods accept a `Params` object where values can be primitives or filter operators:

```typescript
type Filter =
  | { op: "and"; val: Filter[] } // AND multiple conditions
  | { op: "in"; val: (string | number | boolean | null)[] } // IN operator
  | { op: "notin"; val: (string | number | boolean | null)[] } // NOT IN operator
  | { op: "any"; val: string | number | boolean } // ANY array comparison
  | {
      op: "of";
      val: {
        path: string[];
        value: Filter | string | number | boolean | null;
        cast?: "string" | "number" | "boolean" | null;
      };
    } // JSONB path query
  | {
      op: "oftype";
      val: {
        path: string[];
        value: "object" | "array" | "string" | "number" | "boolean" | "null";
      };
    } // JSONB type check
  | { op: "exists"; val: boolean } // IS NULL / IS NOT NULL
  | { op: "lte" | "lt" | "gte" | "gt"; val: number } // Comparison operators
  | { op: "like" | "ilike"; val: string }; // Pattern matching
```

#### Examples

```typescript
// Range query
await dbs
  .collection("products")
  .find({
    price: { op: "gte", val: 10 },
  })
  .toArray();

// IN operator
await dbs
  .collection("users")
  .find({
    role: { op: "in", val: ["admin", "moderator"] },
  })
  .toArray();

// NOT IN operator
await dbs
  .collection("users")
  .find({
    role: { op: "notin", val: ["banned", "deleted"] },
  })
  .toArray();

// ANY operator (PostgreSQL array comparison)
await dbs
  .collection("users")
  .find({
    tags: { op: "any", val: "premium" },
  })
  .toArray();

// JSONB query (PostgreSQL)
await dbs
  .collection("users")
  .find({
    metadata: { op: "of", val: { path: ["age"], value: 30 } },
  })
  .toArray();

// Pattern matching (case-insensitive)
await dbs
  .collection("users")
  .find({
    name: { op: "ilike", val: "%alice%" },
  })
  .toArray();

// Combined conditions
await dbs
  .collection("users")
  .find({
    age: {
      op: "and",
      val: [
        { op: "gte", val: 18 },
        { op: "lt", val: 65 },
      ],
    },
  })
  .toArray();
```

## Transactions

Use `dbs.transaction()` to run multiple operations atomically. Both `dbs` and the transaction object `t` provide a `.raw()` method for executing raw SQL.

```typescript
await dbs.transaction(async (t) => {
  const user = await t
    .collection("users")
    .insert([{ name: "Bob", email: "bob@example.com" }], ["id"]);

  await t.collection("profiles").insert([
    {
      userId: user[0].id,
      bio: "Hello!",
    },
  ]);
});
// Automatically commits if no error, rolls back otherwise
```

## Error Handling

Insert and update operations return structured errors for common constraint violations:

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| `1`  | Unique constraint violation                        |
| `2`  | Foreign key constraint violation (on delete)       |
| `3`  | Check/foreign key constraint violation (on insert) |

```typescript
import { connect } from "@apparts/db";

const dbs = await connect({
  use: "postgresql",
  postgresql: {
    /* ... */
  },
});

try {
  await dbs.collection("users").insert([{ email: "duplicate@example.com" }]);
} catch (e: any) {
  if (e._code === 1) {
    console.log("Duplicate entry");
  }
}
```

## Contributing

See [TASKS.md](./TASKS.md) for planned features and the repository source code for the project structure.

## License

MIT

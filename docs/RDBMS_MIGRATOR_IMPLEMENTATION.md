# RDBMS Migrator — Implementation Plan

Phase 1: PostgreSQL + Oracle (with SQLite for testing)

---

## Overview

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Foundation | Types, driver interface, connection manager, base structure |
| 2 | PostgreSQL Driver | Full driver + connection tools + schema introspection |
| 3 | SQLite Driver + Tests | Test driver + comprehensive test suite |
| 4 | Oracle Driver | Thin mode driver + Oracle-specific metadata |
| 5 | Mapping & Patterns | Pattern definitions, create-mapping, preview-document |
| 6 | Migration Engine | migrate-collection, migrate-all, verification |
| 7 | Polish & Integration | Edge cases, error handling, documentation |

---

## Week 1: Foundation

### Goal
Establish the core architecture, types, and interfaces that all drivers and tools will use.

### Tasks

#### 1.1 Create directory structure
```
packages/mcp-server/src/tools/rdbms/
├── types.ts
├── connection.ts
├── drivers/
│   ├── types.ts
│   └── index.ts
└── index.ts
```

#### 1.2 Define core types (`types.ts`)
- [ ] `RdbmsType` — postgres, oracle, sqlite, mysql, mssql
- [ ] `RdbmsOperationType` — connection, read, write
- [ ] `RdbmsToolDef` — tool definition interface
- [ ] `MigrationPattern` — direct, embed-one, embed-many, reference, extended-ref
- [ ] `ColumnMapping` — source/target field mapping
- [ ] `TableMapping` — full table transformation config
- [ ] `EmbedConfig` — embedding configuration
- [ ] `ReferenceConfig` — reference configuration
- [ ] `TypeMapping` — SQL type to BSON type mapping

#### 1.3 Define driver interface (`drivers/types.ts`)
- [ ] `RdbmsDriver` interface
  - [ ] `connect(connectionString): Promise<void>`
  - [ ] `disconnect(): Promise<void>`
  - [ ] `listTables(schema?): Promise<TableInfo[]>`
  - [ ] `getColumns(table, schema?): Promise<ColumnInfo[]>`
  - [ ] `getPrimaryKey(table, schema?): Promise<string[]>`
  - [ ] `getForeignKeys(table, schema?): Promise<ForeignKeyInfo[]>`
  - [ ] `getReferencingKeys(table, schema?): Promise<ForeignKeyInfo[]>`
  - [ ] `getIndexes(table, schema?): Promise<IndexInfo[]>`
  - [ ] `query<T>(sql, params?): Promise<T[]>`
  - [ ] `streamRows(table, options?): AsyncIterable<Row[]>`
  - [ ] `countRows(table, schema?): Promise<number>`
- [ ] `TableInfo`, `ColumnInfo`, `ForeignKeyInfo`, `IndexInfo` types

#### 1.4 Implement RdbmsConnectionManager (`connection.ts`)
- [ ] `register(name, type, connectionString)` — register without connecting
- [ ] `connect(name)` — connect to registered RDBMS
- [ ] `disconnect(name)` — disconnect specific connection
- [ ] `disconnectAll()` — cleanup all connections
- [ ] `getDriver(name?)` — get driver for connection
- [ ] `hasConnection(name)` — check if registered
- [ ] `isConnected(name)` — check if connected
- [ ] `listConnections()` — list all with status

#### 1.5 Create driver factory (`drivers/index.ts`)
- [ ] `createDriver(type: RdbmsType): RdbmsDriver`
- [ ] Export driver types

#### 1.6 Create barrel export (`index.ts`)
- [ ] Export `RDBMS_TOOLS` (empty array initially)
- [ ] Export `RdbmsConnectionManager`
- [ ] Export types

#### 1.7 Update dependencies
```bash
npm install pg oracledb better-sqlite3 --workspace=@orbit/mcp-server
npm install -D @types/pg @types/better-sqlite3 --workspace=@orbit/mcp-server
```

### Deliverables
- [ ] All types defined and exported
- [ ] Driver interface defined
- [ ] RdbmsConnectionManager implemented
- [ ] Package compiles cleanly

---

## Week 2: PostgreSQL Driver

### Goal
Complete PostgreSQL driver with full schema introspection and connection tools.

### Tasks

#### 2.1 Implement PostgresDriver (`drivers/postgres.ts`)
- [ ] `connect()` — create connection pool
- [ ] `disconnect()` — close pool
- [ ] `listTables()` — query information_schema.tables
- [ ] `getColumns()` — query information_schema.columns + constraint info
- [ ] `getPrimaryKey()` — query table_constraints + key_column_usage
- [ ] `getForeignKeys()` — query referential_constraints
- [ ] `getReferencingKeys()` — reverse FK lookup
- [ ] `getIndexes()` — query pg_indexes
- [ ] `query()` — execute parameterized query
- [ ] `streamRows()` — cursor-based streaming with LIMIT/OFFSET
- [ ] `countRows()` — SELECT COUNT(*)

#### 2.2 Implement type mapping (`drivers/postgres.ts`)
```typescript
const PG_TYPE_MAP: Record<string, BsonType> = {
  'integer': 'int',
  'bigint': 'long',
  'smallint': 'int',
  'numeric': 'decimal',
  'real': 'double',
  'double precision': 'double',
  'boolean': 'bool',
  'text': 'string',
  'varchar': 'string',
  'character varying': 'string',
  'char': 'string',
  'timestamp': 'date',
  'timestamp with time zone': 'date',
  'timestamp without time zone': 'date',
  'date': 'date',
  'time': 'string',
  'json': 'object',
  'jsonb': 'object',
  'uuid': 'string',
  'bytea': 'binData',
  'array': 'array',
};
```

#### 2.3 Create connection tools (`connection-tools.ts`)
- [ ] `connect-rdbms` — connect to RDBMS by name or connection string
- [ ] `disconnect-rdbms` — disconnect from RDBMS
- [ ] `list-rdbms` — list registered RDBMS connections with status

#### 2.4 Create schema tools (`schema-tools.ts`)
- [ ] `introspect-schema` — extract full schema (tables, columns, keys, indexes)
- [ ] `analyze-relationships` — detect FK relationships, cardinality (1:1, 1:N, N:N)
- [ ] `recommend-patterns` — suggest migration patterns based on schema analysis

#### 2.5 Register driver
- [ ] Add PostgresDriver to driver factory
- [ ] Export connection and schema tools in `RDBMS_TOOLS`

### Deliverables
- [ ] PostgresDriver fully implemented
- [ ] Connection tools working
- [ ] Schema introspection working
- [ ] Manual testing against local PostgreSQL

---

## Week 3: SQLite Driver + Test Suite

### Goal
Implement SQLite driver for fast testing and build comprehensive test suite.

### Tasks

#### 3.1 Implement SqliteDriver (`drivers/sqlite.ts`)
- [ ] `connect()` — open database file or :memory:
- [ ] `disconnect()` — close database
- [ ] `listTables()` — query sqlite_master
- [ ] `getColumns()` — PRAGMA table_info
- [ ] `getPrimaryKey()` — parse from table_info
- [ ] `getForeignKeys()` — PRAGMA foreign_key_list
- [ ] `getReferencingKeys()` — scan all tables for FKs pointing here
- [ ] `getIndexes()` — PRAGMA index_list + index_info
- [ ] `query()` — execute query
- [ ] `streamRows()` — LIMIT/OFFSET streaming
- [ ] `countRows()` — SELECT COUNT(*)

#### 3.2 SQLite type mapping
```typescript
const SQLITE_TYPE_MAP: Record<string, BsonType> = {
  'INTEGER': 'int',
  'REAL': 'double',
  'TEXT': 'string',
  'BLOB': 'binData',
  'NUMERIC': 'decimal',
  'BOOLEAN': 'bool',
  'DATE': 'date',
  'DATETIME': 'date',
};
```

#### 3.3 Create test utilities (`rdbms-tools.test.ts`)
- [ ] `createTestDb()` — create in-memory SQLite with sample schema
- [ ] Sample schemas:
  - [ ] Simple (users, posts)
  - [ ] 1:N relationship (orders, order_items)
  - [ ] N:N relationship (students, courses, enrollments)
  - [ ] Self-referencing (employees with manager_id)
  - [ ] Composite primary keys
  - [ ] Composite foreign keys

#### 3.4 Write unit tests
- [ ] Connection manager tests
  - [ ] Register, connect, disconnect
  - [ ] Multiple connections
  - [ ] Error handling
- [ ] Driver interface tests (using SQLite)
  - [ ] listTables
  - [ ] getColumns (types, nullability, defaults)
  - [ ] getPrimaryKey (simple, composite)
  - [ ] getForeignKeys
  - [ ] getReferencingKeys
  - [ ] getIndexes
  - [ ] streamRows (batching)
  - [ ] countRows
- [ ] Connection tools tests
  - [ ] connect-rdbms
  - [ ] disconnect-rdbms
  - [ ] list-rdbms
- [ ] Schema tools tests
  - [ ] introspect-schema
  - [ ] analyze-relationships

#### 3.5 PostgreSQL integration tests
- [ ] Docker Compose setup for PostgreSQL
- [ ] Same test cases against real PostgreSQL
- [ ] CI configuration (GitHub Actions)

### Deliverables
- [ ] SqliteDriver implemented
- [ ] Comprehensive test suite (50+ tests)
- [ ] All tests passing
- [ ] CI pipeline configured

---

## Week 4: Oracle Driver

### Goal
Implement Oracle driver using thin mode (pure JavaScript, no Oracle Client).

### Tasks

#### 4.1 Implement OracleDriver (`drivers/oracle.ts`)
- [ ] `connect()` — thin mode connection (oracledb 6.0+)
- [ ] `disconnect()` — close connection pool
- [ ] `listTables()` — query ALL_TABLES or USER_TABLES
- [ ] `getColumns()` — query ALL_TAB_COLUMNS
- [ ] `getPrimaryKey()` — query ALL_CONSTRAINTS + ALL_CONS_COLUMNS
- [ ] `getForeignKeys()` — query ALL_CONSTRAINTS (R type)
- [ ] `getReferencingKeys()` — reverse FK lookup
- [ ] `getIndexes()` — query ALL_INDEXES + ALL_IND_COLUMNS
- [ ] `query()` — execute with bind variables
- [ ] `streamRows()` — OFFSET/FETCH or ROWNUM streaming
- [ ] `countRows()` — SELECT COUNT(*)

#### 4.2 Oracle metadata queries
```sql
-- List tables
SELECT table_name, owner FROM all_tables WHERE owner = :schema;

-- Get columns
SELECT column_name, data_type, data_length, data_precision, data_scale,
       nullable, data_default
FROM all_tab_columns
WHERE owner = :schema AND table_name = :table
ORDER BY column_id;

-- Get primary key
SELECT cols.column_name
FROM all_constraints cons
JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name
WHERE cons.constraint_type = 'P'
  AND cons.owner = :schema
  AND cons.table_name = :table
ORDER BY cols.position;

-- Get foreign keys
SELECT a.constraint_name, a.table_name as source_table,
       a.column_name as source_column,
       c_pk.table_name as target_table,
       b.column_name as target_column
FROM all_cons_columns a
JOIN all_constraints c ON a.constraint_name = c.constraint_name
JOIN all_constraints c_pk ON c.r_constraint_name = c_pk.constraint_name
JOIN all_cons_columns b ON c_pk.constraint_name = b.constraint_name
WHERE c.constraint_type = 'R'
  AND a.owner = :schema
  AND a.table_name = :table;
```

#### 4.3 Oracle type mapping
```typescript
const ORACLE_TYPE_MAP: Record<string, BsonType> = {
  'NUMBER': 'decimal',      // Check precision for int vs decimal
  'INTEGER': 'int',
  'FLOAT': 'double',
  'BINARY_FLOAT': 'double',
  'BINARY_DOUBLE': 'double',
  'VARCHAR2': 'string',
  'NVARCHAR2': 'string',
  'CHAR': 'string',
  'NCHAR': 'string',
  'CLOB': 'string',
  'NCLOB': 'string',
  'DATE': 'date',
  'TIMESTAMP': 'date',
  'TIMESTAMP WITH TIME ZONE': 'date',
  'TIMESTAMP WITH LOCAL TIME ZONE': 'date',
  'RAW': 'binData',
  'BLOB': 'binData',
  'LONG RAW': 'binData',
  'ROWID': 'string',
  'XMLTYPE': 'string',
};

// Special handling for NUMBER
function mapOracleNumber(precision?: number, scale?: number): BsonType {
  if (scale === 0 && precision && precision <= 10) return 'int';
  if (scale === 0 && precision && precision <= 18) return 'long';
  return 'decimal';
}
```

#### 4.4 Oracle-specific handling
- [ ] Case sensitivity (Oracle defaults to UPPERCASE)
- [ ] Schema = user in Oracle
- [ ] Handle LONG and LONG RAW (deprecated but common)
- [ ] Handle LOB streaming for large CLOB/BLOB

#### 4.5 Oracle tests
- [ ] Oracle XE Docker container setup
- [ ] Or Oracle Cloud Free Tier connection
- [ ] Same test cases as PostgreSQL/SQLite
- [ ] Oracle-specific edge cases

### Deliverables
- [ ] OracleDriver fully implemented (thin mode)
- [ ] Oracle type mapping complete
- [ ] Tests passing against Oracle XE
- [ ] Documentation for Oracle connection strings

---

## Week 5: Mapping & Patterns

### Goal
Implement migration pattern logic and mapping tools.

### Tasks

#### 5.1 Define patterns (`patterns.ts`)
```typescript
interface PatternDefinition {
  name: MigrationPattern;
  description: string;
  applicableWhen: (analysis: RelationshipAnalysis) => boolean;
  pros: string[];
  cons: string[];
}

const PATTERNS: PatternDefinition[] = [
  {
    name: 'direct',
    description: 'Map table directly to collection (1:1)',
    applicableWhen: (a) => !a.hasRelationships,
    pros: ['Simple', 'Fast migration', 'Easy to understand'],
    cons: ['May require $lookup for joins'],
  },
  {
    name: 'embed-many',
    description: 'Embed child rows as array in parent document',
    applicableWhen: (a) => a.hasOneToMany && a.childCount < 100,
    pros: ['Single read for parent + children', 'Atomic updates'],
    cons: ['Document size limit (16MB)', 'Duplication if child shared'],
  },
  // ... more patterns
];
```

#### 5.2 Implement relationship analyzer (`introspection.ts`)
- [ ] `analyzeRelationships(driver, schema)` → RelationshipAnalysis
  - [ ] Detect 1:1 relationships (unique FK)
  - [ ] Detect 1:N relationships (non-unique FK)
  - [ ] Detect N:N relationships (junction tables)
  - [ ] Detect self-referencing (FK to same table)
  - [ ] Calculate average child counts
  - [ ] Identify hot/cold tables by relationship count

#### 5.3 Create mapping tools (`mapping-tools.ts`)
- [ ] `create-mapping` — create transformation mapping
  - Input: source table, target collection, pattern, column mappings
  - Output: validated TableMapping object
  - Store in session/memory for later use
- [ ] `preview-document` — show sample transformed document
  - Input: mapping, sample size
  - Fetch sample rows, apply transformation, return preview
- [ ] `validate-mapping` — check for issues
  - Circular embeddings
  - Unbounded arrays
  - Missing required fields
  - Type compatibility
- [ ] `list-mappings` — show all defined mappings
- [ ] `delete-mapping` — remove a mapping

#### 5.4 Implement transform logic (`transform.ts`)
```typescript
interface TransformContext {
  rdbms: RdbmsDriver;
  mapping: TableMapping;
  typeMap: TypeMapping;
}

async function transformRow(
  row: Record<string, unknown>,
  ctx: TransformContext,
): Promise<Document> {
  const doc: Document = {};

  // Apply column mappings
  for (const col of ctx.mapping.columns) {
    let value = row[col.source];
    if (col.transform) {
      value = applyTransform(value, col.transform);
    }
    doc[col.target] = convertType(value, ctx.typeMap);
  }

  // Apply embeddings
  for (const embed of ctx.mapping.embed ?? []) {
    doc[embed.targetField] = await fetchEmbedded(row, embed, ctx);
  }

  // Apply references
  for (const ref of ctx.mapping.reference ?? []) {
    doc[ref.targetField] = buildReference(row, ref);
  }

  return doc;
}
```

#### 5.5 Write mapping tests
- [ ] Pattern applicability tests
- [ ] Relationship detection tests
- [ ] Transform logic tests
- [ ] Preview generation tests
- [ ] Validation tests

### Deliverables
- [ ] Pattern definitions complete
- [ ] Relationship analyzer working
- [ ] Mapping tools implemented
- [ ] Transform logic tested
- [ ] Preview showing accurate sample documents

---

## Week 6: Migration Engine

### Goal
Implement data migration execution with progress tracking and verification.

### Tasks

#### 6.1 Create migration tools (`migration-tools.ts`)
- [ ] `estimate-migration` — estimate time and resources
  - Row counts per table
  - Estimated document sizes
  - Total data volume
  - Estimated time (based on batch size)
- [ ] `migrate-collection` — migrate single table/mapping
  - Batch streaming from source
  - Transform each batch
  - Insert into MongoDB
  - Progress reporting
  - Error handling (continue vs abort)
- [ ] `migrate-all` — migrate all mappings
  - Dependency ordering (parent before child for references)
  - Parallel where possible
  - Overall progress
  - Summary report
- [ ] `verify-migration` — verify data integrity
  - Row count comparison
  - Sample document spot-checks
  - Checksum comparison (optional)
  - Relationship integrity

#### 6.2 Implement migration executor (`migration.ts`)
```typescript
interface MigrationOptions {
  batchSize: number;        // Default: 1000
  parallel: number;         // Concurrent batches, default: 1
  onError: 'abort' | 'continue' | 'log';
  onProgress?: (progress: MigrationProgress) => void;
}

interface MigrationProgress {
  table: string;
  totalRows: number;
  migratedRows: number;
  percent: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  errors: number;
}

async function* migrateTable(
  source: RdbmsDriver,
  target: Collection,
  mapping: TableMapping,
  options: MigrationOptions,
): AsyncGenerator<MigrationProgress> {
  const totalRows = await source.countRows(mapping.sourceTable);
  let migratedRows = 0;
  let errors = 0;
  const startTime = Date.now();

  for await (const batch of source.streamRows(mapping.sourceTable, {
    batchSize: options.batchSize,
  })) {
    try {
      const documents = await Promise.all(
        batch.map((row) => transformRow(row, { mapping, ... })),
      );
      await target.insertMany(documents, { ordered: false });
      migratedRows += batch.length;
    } catch (err) {
      errors++;
      if (options.onError === 'abort') throw err;
    }

    yield {
      table: mapping.sourceTable,
      totalRows,
      migratedRows,
      percent: (migratedRows / totalRows) * 100,
      elapsedMs: Date.now() - startTime,
      estimatedRemainingMs: /* calculate */,
      errors,
    };
  }
}
```

#### 6.3 Implement verification (`verify.ts`)
```typescript
interface VerificationResult {
  table: string;
  collection: string;
  sourceCount: number;
  targetCount: number;
  countMatch: boolean;
  sampleChecks: SampleCheck[];
  passed: boolean;
  issues: string[];
}

interface SampleCheck {
  sourceId: unknown;
  found: boolean;
  fieldsMatch: boolean;
  differences?: FieldDiff[];
}
```

#### 6.4 Add utility tools (`utility-tools.ts`)
- [ ] `generate-indexes` — recommend MongoDB indexes based on:
  - Source indexes
  - Foreign key columns (now references)
  - Primary keys
- [ ] `generate-validation` — create JSON Schema for target collection
- [ ] `export-mapping` — save mappings to JSON file
- [ ] `import-mapping` — load mappings from JSON file

#### 6.5 Write migration tests
- [ ] Small dataset migration (100 rows)
- [ ] Batch boundary tests
- [ ] Error handling tests
- [ ] Progress callback tests
- [ ] Verification tests
- [ ] End-to-end migration test

### Deliverables
- [ ] Migration engine working
- [ ] Progress tracking implemented
- [ ] Verification tools working
- [ ] Utility tools complete
- [ ] Full migration tested end-to-end

---

## Week 7: Polish & Integration

### Goal
Integrate into MCP server, handle edge cases, documentation.

### Tasks

#### 7.1 Server integration
- [ ] Update `tools/index.ts` to export `RDBMS_TOOLS`
- [ ] Update `server.ts` to register RDBMS tools
- [ ] Add `RdbmsConnectionManager` to server factory
- [ ] Handle RDBMS config in `loadConfig()`
- [ ] Add environment variable support (`RDBMS_CONN_*`)

#### 7.2 Config integration
```typescript
// packages/core/src/config/types.ts
interface OrbitConfig {
  // ... existing
  rdbms?: {
    connections?: Record<string, {
      type: RdbmsType;
      connectionString: string;
    }>;
  };
}
```

#### 7.3 Edge case handling
- [ ] Null values
- [ ] Empty strings vs nulls
- [ ] Unicode/encoding
- [ ] Large text fields (CLOB/TEXT)
- [ ] Binary data (BLOB/BYTEA)
- [ ] Date/time zones
- [ ] Decimal precision
- [ ] Very long column names
- [ ] Reserved words as column names
- [ ] Tables with no primary key

#### 7.4 Error handling
- [ ] Connection failures (retry logic)
- [ ] Query timeouts
- [ ] Out of memory (batch size tuning)
- [ ] Duplicate key errors
- [ ] Type conversion errors
- [ ] Clear error messages for users

#### 7.5 Documentation
- [ ] Update README.md with RDBMS tools
- [ ] Add RDBMS section to CHANGELOG.md
- [ ] Create docs/RDBMS_MIGRATION_GUIDE.md
  - [ ] Quick start
  - [ ] Connection setup
  - [ ] Pattern selection guide
  - [ ] Step-by-step migration workflow
  - [ ] Troubleshooting

#### 7.6 Final testing
- [ ] Full migration: PostgreSQL → MongoDB
- [ ] Full migration: Oracle → MongoDB
- [ ] Large dataset test (1M+ rows)
- [ ] Complex schema test (20+ tables)
- [ ] CI pipeline green

### Deliverables
- [ ] Fully integrated into MCP server
- [ ] Configuration documented
- [ ] Edge cases handled
- [ ] Documentation complete
- [ ] CI passing
- [ ] Ready for release

---

## Tool Summary

| Tool | Category | Week |
|------|----------|------|
| `connect-rdbms` | Connection | 2 |
| `disconnect-rdbms` | Connection | 2 |
| `list-rdbms` | Connection | 2 |
| `introspect-schema` | Schema | 2 |
| `analyze-relationships` | Schema | 5 |
| `recommend-patterns` | Schema | 5 |
| `create-mapping` | Mapping | 5 |
| `preview-document` | Mapping | 5 |
| `validate-mapping` | Mapping | 5 |
| `list-mappings` | Mapping | 5 |
| `delete-mapping` | Mapping | 5 |
| `estimate-migration` | Migration | 6 |
| `migrate-collection` | Migration | 6 |
| `migrate-all` | Migration | 6 |
| `verify-migration` | Migration | 6 |
| `generate-indexes` | Utility | 6 |
| `generate-validation` | Utility | 6 |
| `export-mapping` | Utility | 6 |
| `import-mapping` | Utility | 6 |

**Total: 19 new tools**

---

## Dependencies

```json
{
  "dependencies": {
    "pg": "^8.11.0",
    "oracledb": "^6.3.0",
    "better-sqlite3": "^9.4.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

---

## Success Criteria

### Week 7 Exit Criteria
- [ ] 19 RDBMS tools implemented and tested
- [ ] PostgreSQL driver complete with all metadata queries
- [ ] Oracle driver complete (thin mode)
- [ ] SQLite driver for testing
- [ ] 100+ unit/integration tests passing
- [ ] Full migration PostgreSQL → MongoDB working
- [ ] Full migration Oracle → MongoDB working
- [ ] Documentation complete
- [ ] CI pipeline green

### Quality Bar
- [ ] All tools have descriptions suitable for LLM
- [ ] Error messages are clear and actionable
- [ ] Progress reporting works for long migrations
- [ ] Verification catches data integrity issues
- [ ] Large datasets (1M+ rows) complete without OOM

# RDBMS to MongoDB Migration Server

A conversational MCP server for migrating relational databases to MongoDB using schema best practices and proven migration patterns.

## Overview

This tool provides an alternative to MongoDB's Relational Migrator, focusing on transparency, composability, and conversational interaction. It does NOT depend on or use the existing MongoDB Relational Migrator.

## Complexity Assessment

**Medium-High** — Not trivial, but well-scoped. The core challenge is schema transformation logic, not infrastructure.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Migration Server                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ RDBMS        │  │ Schema       │  │ Migration            │  │
│  │ Connectors   │  │ Analyzer     │  │ Engine               │  │
│  │              │  │              │  │                      │  │
│  │ - PostgreSQL │  │ - Introspect │  │ - Pattern selection  │  │
│  │ - MySQL      │  │ - Detect FKs │  │ - Transform schema   │  │
│  │ - SQL Server │  │ - Map types  │  │ - Migrate data       │  │
│  │ - SQLite     │  │ - Find 1:N   │  │ - Verify integrity   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Patterns

| Pattern | Use Case | Transformation |
|---------|----------|----------------|
| **1:1 Direct** | Lift-and-shift, minimal changes | table → collection, row → document |
| **Embedded (1:N)** | Parent-child with bounded children | Nest child rows in parent document |
| **Embedded (N:N)** | Many-to-many with small sets | Embed array of references or full docs |
| **Extended Reference** | Frequently joined lookup data | Copy key fields, avoid $lookup |
| **Subset** | Large docs with hot/cold data | Embed hot fields, reference cold |
| **Bucket** | Time-series, IoT, logs | Group by time window |
| **Computed** | Aggregated/derived data | Pre-compute at migration time |

---

## Proposed Tools

### Schema Analysis

| Tool | Description |
|------|-------------|
| `connect-rdbms` | Connect to PostgreSQL/MySQL/SQLite/SQL Server |
| `introspect-schema` | Extract tables, columns, types, constraints |
| `analyze-relationships` | Detect FKs, join patterns, cardinality |
| `recommend-patterns` | Suggest migration patterns based on schema |

### Schema Mapping

| Tool | Description |
|------|-------------|
| `create-mapping` | Define source→target mapping with pattern |
| `preview-document` | Show sample transformed document |
| `validate-mapping` | Check for issues (circular refs, unbounded arrays) |

### Migration

| Tool | Description |
|------|-------------|
| `estimate-migration` | Size, document count, time estimate |
| `migrate-collection` | Transform and load one collection |
| `migrate-all` | Run full migration with progress |
| `verify-migration` | Compare counts, spot-check data |

### Utilities

| Tool | Description |
|------|-------------|
| `generate-indexes` | Recommend indexes based on original schema |
| `generate-validation` | Create JSON Schema from mapping |
| `export-mapping` | Save mapping as JSON for version control |

---

## Technical Stack

```typescript
// RDBMS connectors - use existing Node.js drivers
import pg from "pg";                   // PostgreSQL
import mysql2 from "mysql2";           // MySQL
import mssql from "mssql";             // SQL Server
import sqlite3 from "better-sqlite3";  // SQLite

// Schema introspection via information_schema (standard SQL)
// No dependency on MongoDB Relational Migrator
```

---

## Key Design Decisions

### 1. Pattern-first approach

```
User: "migrate the orders table"
Tool: "orders has 1:N relationship with order_items. Recommend:
       A) Embed order_items (if typically <100 items per order)
       B) Reference (if unbounded or accessed independently)
       Which pattern?"
```

### 2. Interactive refinement

```
User: "show me what an embedded order document would look like"
Tool: [preview-document with sample data]
User: "include customer name but not full customer record"
Tool: [applies extended reference pattern for customer]
```

### 3. Streaming migration for large tables

```typescript
// Batch processing with backpressure
async function* migrateTable(source, mapping, batchSize = 1000) {
  for await (const batch of streamRows(source, batchSize)) {
    const documents = batch.map(row => transform(row, mapping));
    yield await targetCollection.insertMany(documents);
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (1-2 weeks)

- RDBMS connectors (start with PostgreSQL + SQLite)
- Schema introspection tools
- Basic 1:1 migration

### Phase 2: Patterns (1-2 weeks)

- Embedding patterns (1:N, N:N)
- Extended reference pattern
- Pattern recommendation engine

### Phase 3: Production-ready (1 week)

- Batch migration with progress
- Verification tools
- Index/validation generation

### Phase 4: Advanced (optional)

- SQL query → aggregation translation
- CDC (Change Data Capture) for ongoing sync
- Additional RDBMS support

---

## Why This Beats Relational Migrator

1. **Conversational** — Natural language interaction, not clunky UI
2. **Transparent** — See exactly what's happening, debug easily
3. **Composable** — Mix tools, customize transformations
4. **Scriptable** — Automate with prompts, version control mappings
5. **Extensible** — Add patterns, customize for your domain

---

## Effort Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Foundation | 40-60 hours |
| Phase 2: Patterns | 30-40 hours |
| Phase 3: Production | 20-30 hours |
| **Total MVP** | **~100 hours** |

---

## Getting Started

Phase 1 starting point:

1. PostgreSQL connector using `pg` driver
2. Schema introspection via `information_schema`
3. Basic 1:1 migration (table → collection)
4. Type mapping (SQL types → BSON types)

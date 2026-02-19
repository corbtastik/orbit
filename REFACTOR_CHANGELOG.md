# OrbitAI Refactoring Changelog

Track progress on codebase improvements identified during code review.

**Started:** 2024-02-18
**Baseline:** 21,455 lines of TypeScript
**Current:** 21,002 lines of TypeScript

---

## Summary

| Phase | Name | Status | Lines Changed |
|-------|------|--------|---------------|
| 1 | Dead Code Removal | **Complete** | -420 lines |
| 2 | Extract Shared Utilities | **Complete** | -113 lines |
| 3 | Consolidate Constants & Types | Pending | - |
| 4 | Split Large Files | Pending | - |
| 5 | Fix Inconsistencies | Pending | - |
| 6 | Refactor Complex Classes | Pending | - |

---

## Phase 3: Consolidate Constants & Types

**Risk:** Low
**Goal:** Centralize magic constants and reduce type duplication.

### Tasks

- [ ] **3.1** Create `packages/mcp-server/src/tools/constants.ts`
  - Move `MAX_FIND_LIMIT` from `read-tools.ts`
  - Move `MAX_AGGREGATE_LIMIT` from `read-tools.ts`
  - Move `MAX_INSERT_BATCH` from `write-tools.ts`
  - Move `ISO_DATE_REGEX` from `write-tools.ts`

- [ ] **3.2** Create generic `ToolDef<TConn>` base interface
  - In `packages/mcp-server/src/tools/types.ts`
  - Have `DatabaseToolDef` and `RdbmsToolDef` extend it
  - Reduces duplicate interface definitions

- [ ] **3.3** Consolidate RDBMS type exports
  - Review exports in `packages/mcp-server/src/tools/rdbms/index.ts`
  - Remove driver-internal exports not needed by consumers (e.g., `PG_TYPE_MAP`)

### Verification
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] Type checking passes with no new errors

---

## Phase 4: Split Large Files

**Risk:** Medium
**Goal:** Improve maintainability by splitting files >400 lines.

### Tasks

- [ ] **4.1** Split `mapping-tools.ts` (967 lines)
  - `mapping-tools/create.ts` — createMappingTool
  - `mapping-tools/update.ts` — updateMappingTool
  - `mapping-tools/preview.ts` — previewDocumentTool
  - `mapping-tools/validate.ts` — validateMappingTool
  - `mapping-tools/list-delete.ts` — listMappingsTool, deleteMappingTool
  - `mapping-tools/index.ts` — barrel export

- [ ] **4.2** Extract command handling from `apps/cli/src/index.ts` (387 lines)
  - Create `apps/cli/src/commands.ts`
  - Move `handleCommand()` function
  - Move `printConfig()` function
  - Move utility functions: `mask()`, `val()`

- [ ] **4.3** Split `screen.ts` (431 lines) — Optional/Future
  - Evaluate if `OraScreenAdapter` should be separate
  - Evaluate if `TerminalZones` abstraction is worthwhile

### Verification
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] CLI functionality unchanged
- [ ] All MCP tools work correctly

---

## Phase 5: Fix Inconsistencies

**Risk:** Low-Medium
**Goal:** Standardize patterns across the codebase.

### Tasks

- [ ] **5.1** Standardize connection parameter naming
  - Change `_connectionName` to `connection` in database tools
  - Files: `read-tools.ts`, `write-tools.ts`, `delete-tools.ts`, `update-tools.ts`, `metadata-tools.ts`

- [ ] **5.2** Fix silent config failures in `packages/core/src/config/loader.ts`
  - Add logging or throw on JSON parse errors
  - Distinguish between missing file vs corrupted file

- [ ] **5.3** Standardize provider constructor signatures — Optional/Future
  - Consider migrating all providers to options object pattern
  - Lower priority; current system works

### Verification
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] Config loading errors are now visible

---

## Phase 6: Refactor Complex Classes

**Risk:** Medium-High
**Goal:** Reduce class complexity and improve testability.

### Tasks

- [ ] **6.1** Refactor `ScreenManager` (431 lines) — Optional/Future
  - Extract ora proxy to `OraScreenAdapter`
  - Extract zone management to `TerminalZones`
  - Keep `ScreenManager` as coordinator
  - Requires careful testing of terminal rendering

- [ ] **6.2** Refactor `AtlasClient` request method — Optional/Future
  - Extract retry logic to separate function
  - Improve error context preservation
  - Add request logging option

- [ ] **6.3** Consider ActionMap code generation — Optional/Future
  - Generate 41 ActionMaps from metadata specification
  - Would eliminate ~700 lines of repetitive declarations
  - Requires build tooling changes

### Verification
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] Terminal UI works correctly
- [ ] Atlas API calls work correctly

---

## Completed

### Phase 1: Dead Code Removal ✓

**Completed:** 2024-02-18
**Lines Removed:** 420
**Tests Removed:** 16 (tests for dead code)

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Delete `apps/cli/src/tools/executor.ts` | ✓ |
| 1.2 | Delete `apps/cli/src/tools/schema.ts` | ✓ |
| 1.3 | Delete `apps/cli/src/ui/input-buffer.ts` | ✓ |
| 1.4 | Remove `createMcpClient()`, `getServerInstructions()` from `mcp/client.ts` | ✓ |
| 1.5 | Remove `createHttpTransportOnly()`, `createStdioTransportOnly()` from `mcp/transport.ts` | ✓ |
| 1.6 | Update `tools/index.ts` barrel exports | ✓ |
| 1.7 | Update `ui/index.ts` barrel exports | ✓ |
| 1.8 | Update `mcp/index.ts` barrel exports | ✓ |

**Also removed:**
- `apps/cli/src/tools/executor.test.ts` (8 tests)
- `apps/cli/src/tools/schema.test.ts` (8 tests)

**Verification:**
- ✓ `npm run build` passes
- ✓ `npm run test` passes (353 tests, down from 369)

---

### Phase 2: Extract Shared Utilities ✓

**Completed:** 2024-02-18
**Lines Removed:** 113 (net)

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Create `packages/mcp-server/src/tools/rdbms/utils.ts` with `getMappingStore()` | ✓ |
| 2.2 | Create `apps/cli/src/ui/ansi.ts` with ANSI cursor helpers and `stripAnsi()` | ✓ |
| 2.3 | Add `connectionProperty` to `packages/mcp-server/src/tools/database/types.ts` | ✓ |

**Files updated:**
- `mapping-tools.ts`, `migration-tools.ts`, `utility-tools.ts` — use shared `getMappingStore()`
- `screen.ts`, `command-palette.ts` — use shared ANSI helpers
- `read-tools.ts`, `write-tools.ts`, `delete-tools.ts`, `update-tools.ts`, `metadata-tools.ts` — use shared `connectionProperty`

**Verification:**
- ✓ `npm run build` passes
- ✓ `npm run test` passes (353 tests)

---

## Notes

- Always run full test suite before and after each phase
- Commit after each task for easy rollback
- Update line counts after each phase completion

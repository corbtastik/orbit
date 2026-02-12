/**
 * Core types for the MongoDB Relational Migrator REST API.
 */

/** Configuration for connecting to the Relational Migrator API. */
export interface RelationalMigratorConfig {
  /** Base URL for the Relational Migrator API. Default: http://127.0.0.1:8278 */
  baseUrl?: string;
  /** API version path segment. Default: v1 */
  apiVersion?: string;
  /** Request timeout in milliseconds. Default: 30000 */
  timeoutMs?: number;
  /** Enable the Relational Migrator integration. Default: true */
  enabled?: boolean;
}

/** Resolved config with all defaults applied. */
export interface ResolvedRelationalMigratorConfig {
  baseUrl: string;
  apiVersion: string;
  timeoutMs: number;
  enabled: boolean;
}

/** Standard Relational Migrator API error response body. */
export interface RelationalMigratorErrorBody {
  jobId?: string | null;
  message?: string;
  description?: string | null;
  timestamp?: string | null;
}

/** Spring Boot error response format. */
export interface SpringBootErrorBody {
  timestamp?: string;
  status?: number;
  error?: string;
  path?: string;
}

/** Supported relational database types. */
export type RelationalDatabaseType =
  | "POSTGRESQL"
  | "MYSQL"
  | "ORACLE"
  | "SQL_SERVER"
  | "DB2"
  | "SYBASE"
  | "SYBASEIQ"
  | "COCKROACHDB"
  | "YUGABYTE"
  | "SQLANYWHERE";

/** Project summary returned by list endpoint. */
export interface ProjectSummary {
  id: string;
  jdbcId: string | null;
  mongodbId: string | null;
  name: string;
  type: RelationalDatabaseType;
  lastModified: string;
}

/** Full project details. */
export interface Project extends ProjectSummary {
  schemasId: string;
  content: ProjectContent;
  connectionDetails: ConnectionDetails;
  isSampleProject: boolean;
}

/** Project content including mappings and diagrams. */
export interface ProjectContent {
  settings: ProjectSettings;
  collections: Record<string, { name: string }>;
  mappings: Record<string, MappingRule>;
  relationships: ProjectRelationships;
  diagrams: DiagramConfig;
  tables: Record<string, TablePath>;
}

/** Project settings. */
export interface ProjectSettings {
  viewMode: string | null;
  shouldRecommendSchema: boolean;
  casing: "CAMEL_CASE" | "SNAKE_CASE" | "PASCAL_CASE" | "NONE";
  excludedJsonExportCollections: string[];
  keyHandling: "GENERATED" | "PRESERVE";
}

/** Mapping rule definition. */
export interface MappingRule {
  settings: MappingSettings;
  fields: Record<string, FieldMapping>;
  calculatedFields: Record<string, unknown>;
  collectionId: string;
  table: string;
}

/** Mapping rule settings. */
export interface MappingSettings {
  type: "NEW_DOCUMENT" | "EMBEDDED" | "ARRAY";
  notes: string | null;
  embeddedPath: string | null;
  primitive: string | null;
  arrayConditions: unknown | null;
  foreignKeyName: string | null;
  ruleFilter: unknown | null;
}

/** Field mapping between source and target. */
export interface FieldMapping {
  target: TargetField;
  source: SourceField;
}

/** Target MongoDB field definition. */
export interface TargetField {
  name: string;
  included: boolean;
  isNullExcluded: boolean;
  type: MongoDBFieldType;
}

/** Source relational field definition. */
export interface SourceField {
  name: string;
  databaseSpecificType: string;
  isPrimaryKey: boolean;
}

/** MongoDB field types. */
export type MongoDBFieldType =
  | "STRING"
  | "INTEGER"
  | "DECIMAL"
  | "DATE"
  | "BOOLEAN"
  | "OBJECT_ID"
  | "BIN_DATA"
  | "ARRAY"
  | "OBJECT";

/** Project relationships. */
export interface ProjectRelationships {
  tables: Record<string, { mappings: string[] }>;
  collections: Record<string, { mappings: string[] }>;
  mappings: Record<string, { children: string[] }>;
}

/** Diagram configuration. */
export interface DiagramConfig {
  activeTab: string;
  tabs: DiagramTab[];
}

/** Single diagram tab. */
export interface DiagramTab {
  id: string;
  name: string;
  notes: string | null;
  relational: { nodes: unknown[]; edges: unknown[] };
  collection: { nodes: unknown[]; edges: unknown[] };
}

/** Table path reference. */
export interface TablePath {
  path: {
    database: string;
    schema: string;
    table: string;
  };
}

/** Connection details. */
export interface ConnectionDetails {
  ddl: string | null;
}

/** JDBC connection definition. */
export interface JdbcConnection {
  id?: string;
  name: string;
  url: string;
  type: RelationalDatabaseType;
  username?: string;
  password?: string;
}

/** MongoDB connection definition. */
export interface MongoDBConnection {
  id?: string;
  name: string;
  connectionString: string;
}

/** Migration job definition. */
export interface MigrationJob {
  id?: string;
  projectId: string;
  jdbcConnectionDetails: JdbcConnectionDetails;
  mongodbConnectionDetails: MongoDBConnectionDetails;
  options: JobOptions;
  verification: JobVerification;
}

/** JDBC connection details for job creation. */
export interface JdbcConnectionDetails {
  url: string;
  type: RelationalDatabaseType;
  username?: string;
  password?: string;
}

/** MongoDB connection details for job creation. */
export interface MongoDBConnectionDetails {
  connectionString: string;
  database?: string;
}

/** Job options. */
export interface JobOptions {
  mode?: "SNAPSHOT" | "CDC" | "SNAPSHOT_AND_CDC";
  dropCollections?: boolean;
  batchSize?: number;
  parallelism?: number;
}

/** Job verification settings. */
export interface JobVerification {
  enabled?: boolean;
  sampleSize?: number;
}

/** Job status. */
export interface JobStatus {
  id: string;
  projectId: string;
  status: "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "STOPPED";
  progress?: JobProgress;
  startTime?: string;
  endTime?: string;
}

/** Job progress details. */
export interface JobProgress {
  tablesCompleted: number;
  tablesTotal: number;
  rowsMigrated: number;
  rowsTotal: number;
}

/** System info response. */
export interface SystemInfo {
  build: {
    artifact: string;
    name: string;
    time: string;
    version: string;
    group: string;
  };
  buildStatus: {
    latest: boolean;
    enabled: boolean;
    latestReleaseURL: string;
    latestReleaseType: string;
    latestReleaseVersion: string;
  };
  jdbcDriversFound: Record<string, JdbcDriverInfo>;
  telemetry: { enabled: boolean };
  credentials: { isCredentialsStoreValid: boolean };
  news: { enabled: boolean };
  featureFlags: Record<string, unknown>;
  deployment: { type: string; environment: string };
}

/** JDBC driver info. */
export interface JdbcDriverInfo {
  currentVersion: string | null;
  supportedVersions: string[];
  isValid: boolean;
  displayName: string;
  downloadLink: string | null;
}

/** Health status response. */
export interface HealthStatus {
  status: "UP" | "DOWN";
  groups: string[];
  components: Record<string, ComponentHealth>;
}

/** Component health info. */
export interface ComponentHealth {
  status: "UP" | "DOWN";
  details?: Record<string, unknown>;
}

/** Connectivity environment response. */
export interface ConnectivityEnvironment {
  deployment: {
    type: string;
    environment: string;
  };
  errors: string[];
}

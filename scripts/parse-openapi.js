#!/usr/bin/env node
//
// parse-openapi.js
//
// Parses the MongoDB Atlas Admin API v2 OpenAPI spec and generates:
//   1. docs/atlas-api-catalog.yaml   — structured endpoint catalog
//   2. docs/ATLAS-API-OVERVIEW.md    — lightweight markdown summary
//
// Usage: node scripts/parse-openapi.js [path-to-openapi-yaml]
//
// Default input: docs/atlas-admin-api-v2-openapi-source.yaml

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Domain ↔ Tag mapping (from PLAN.md §1.1)
// ---------------------------------------------------------------------------
const DOMAIN_MAP = {
  cluster_management: {
    name: "Cluster & Deployment Management",
    tags: [
      "Clusters",
      "Flex Clusters",
      "Serverless Instances",
      "Cluster Outage Simulation",
      "Global Clusters",
    ],
  },
  organization_project_admin: {
    name: "Organization & Project Administration",
    tags: [
      "Organizations",
      "Projects",
      "Teams",
      "Programmatic API Keys",
      "Service Accounts",
      "MongoDB Cloud Users",
    ],
  },
  security_access_control: {
    name: "Security & Access Control",
    tags: [
      "Database Users",
      "Custom Database Roles",
      "Project IP Access List",
      "Network Peering",
      "Private Endpoint Services",
      "Serverless Private Endpoints",
      "X.509 Authentication",
      "LDAP Configuration",
      "Federated Authentication",
      "Cloud Provider Access",
      "Encryption at Rest using Customer Key Management",
    ],
  },
  monitoring_alerting: {
    name: "Monitoring & Alerting",
    tags: [
      "Monitoring and Logs",
      "Alert Configurations",
      "Alerts",
      "Performance Advisor",
      "Events",
      "Collection Level Metrics",
      "Access Tracking",
      "Third-Party Integrations",
      "Query Shape Insights",
    ],
  },
  backup_disaster_recovery: {
    name: "Backup & Disaster Recovery",
    tags: [
      "Cloud Backups",
      "Shared-Tier Snapshots",
      "Shared-Tier Restore Jobs",
      "Flex Snapshots",
      "Flex Restore Jobs",
      "Legacy Backup",
    ],
  },
  atlas_services_features: {
    name: "Atlas Services & Features",
    tags: [
      "Atlas Search",
      "Data Federation",
      "Data Lake Pipelines",
      "Online Archive",
      "Streams",
      "Rolling Index",
    ],
  },
  cost_management_billing: {
    name: "Cost Management & Billing",
    tags: ["Invoices"],
  },
  network_infrastructure: {
    name: "Network & Infrastructure",
    tags: [
      "AWS Clusters DNS",
      "Maintenance Windows",
      "Push-Based Log Export",
      "Resource Policies",
    ],
  },
  compliance_governance: {
    name: "Compliance & Governance",
    tags: ["Auditing"],
  },
  migration_integration: {
    name: "Migration & Integration",
    tags: ["Cloud Migration Service"],
  },
  platform: {
    name: "Platform & Activity",
    tags: ["Root", "Activity Feed"],
  },
};

// Build reverse lookup: tag → domain key
const TAG_TO_DOMAIN = {};
for (const [domainKey, domainDef] of Object.entries(DOMAIN_MAP)) {
  for (const tag of domainDef.tags) {
    TAG_TO_DOMAIN[tag] = domainKey;
  }
}

// ---------------------------------------------------------------------------
// 2. Load and parse the OpenAPI spec
// ---------------------------------------------------------------------------
const specPath =
  process.argv[2] ||
  resolve(ROOT, "docs/atlas-admin-api-v2-openapi-source.yaml");

console.log(`Reading OpenAPI spec from: ${specPath}`);
const raw = readFileSync(specPath, "utf-8");
console.log(`Parsing YAML (${(raw.length / 1024 / 1024).toFixed(1)} MB)...`);
const spec = parse(raw);

const specVersion =
  spec.info?.["x-xgen-sha"]?.slice(0, 12) || spec.info?.version || "unknown";
const specTitle = spec.info?.title || "MongoDB Atlas Administration API";
const specApiVersion = spec.info?.version || "2.0";

// ---------------------------------------------------------------------------
// 3. Extract every operation from every path
// ---------------------------------------------------------------------------
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

// Collect all operations grouped by tag
// { tagName: [ { id, method, path, summary, parameters, has_request_body, response_codes } ] }
const tagOperations = {};
let totalOperations = 0;
const allPaths = Object.keys(spec.paths || {});

for (const pathUrl of allPaths) {
  const pathItem = spec.paths[pathUrl];

  // Collect path-level parameters
  const pathParams = (pathItem.parameters || []).map((p) =>
    p.$ref ? refName(p.$ref) : p.name
  );

  for (const method of HTTP_METHODS) {
    const op = pathItem[method];
    if (!op) continue;

    totalOperations++;

    const operationId = op.operationId || `${method}_${pathUrl}`;
    const tags = op.tags || ["Untagged"];
    const summary = op.summary || op.description?.slice(0, 120) || "";

    // Merge path-level + operation-level parameters
    const opParams = (op.parameters || []).map((p) =>
      p.$ref ? refName(p.$ref) : p.name
    );
    const allParams = [...new Set([...pathParams, ...opParams])];

    // Separate path params from query/header params
    const pathParamNames = extractPathParams(pathUrl);

    const hasRequestBody = !!op.requestBody;
    const responseCodes = Object.keys(op.responses || {})
      .map((c) => (c === "default" ? c : parseInt(c, 10)))
      .sort((a, b) => {
        if (a === "default") return 1;
        if (b === "default") return -1;
        return a - b;
      });

    const record = {
      id: operationId,
      method: method.toUpperCase(),
      path: pathUrl,
      summary: summary.trim(),
      parameters: pathParamNames,
      has_request_body: hasRequestBody,
      response_codes: responseCodes,
    };

    for (const tag of tags) {
      if (!tagOperations[tag]) tagOperations[tag] = [];
      tagOperations[tag].push(record);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Build the domain-grouped catalog
// ---------------------------------------------------------------------------
const domains = {};
const unmappedTags = [];

for (const [domainKey, domainDef] of Object.entries(DOMAIN_MAP)) {
  const domainEntry = {
    name: domainDef.name,
    tags: [],
  };

  for (const tagName of domainDef.tags) {
    const ops = tagOperations[tagName];
    if (!ops || ops.length === 0) continue;

    domainEntry.tags.push({
      name: tagName,
      operation_count: ops.length,
      operations: ops.sort((a, b) => {
        const methodOrder = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
        return (methodOrder[a.method] ?? 5) - (methodOrder[b.method] ?? 5);
      }),
    });
  }

  if (domainEntry.tags.length > 0) {
    domains[domainKey] = domainEntry;
  }
}

// Find tags not mapped to any domain
for (const tag of Object.keys(tagOperations)) {
  if (!TAG_TO_DOMAIN[tag]) {
    unmappedTags.push({
      name: tag,
      operation_count: tagOperations[tag].length,
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Build summary stats
// ---------------------------------------------------------------------------
const tagCount = Object.keys(tagOperations).length;
const domainCount = Object.keys(domains).length;
let domainOperationCount = 0;
for (const d of Object.values(domains)) {
  for (const t of d.tags) {
    domainOperationCount += t.operation_count;
  }
}

const summary = {
  total_paths: allPaths.length,
  total_operations: totalOperations,
  domains: domainCount,
  tags_mapped: tagCount - unmappedTags.length,
  tags_unmapped: unmappedTags.length,
  tags_total: tagCount,
};

// ---------------------------------------------------------------------------
// 6. Write YAML catalog
// ---------------------------------------------------------------------------
const catalog = {
  version: specApiVersion,
  generated: new Date().toISOString().split("T")[0],
  source: `MongoDB Atlas Administration API OpenAPI spec (x-xgen-sha: ${spec.info?.["x-xgen-sha"] || "unknown"})`,
  spec_title: specTitle,
  summary,
  domains,
};

if (unmappedTags.length > 0) {
  catalog.unmapped_tags = unmappedTags.map((t) => ({
    name: t.name,
    operation_count: t.operation_count,
    operations: tagOperations[t.name].map((op) => ({
      id: op.id,
      method: op.method,
      path: op.path,
      summary: op.summary,
    })),
  }));
}

const catalogPath = resolve(ROOT, "docs/atlas-api-catalog.yaml");
const yamlOut = stringify(catalog, {
  lineWidth: 120,
  defaultStringType: "QUOTE_DOUBLE",
  defaultKeyType: "PLAIN",
});
writeFileSync(catalogPath, yamlOut, "utf-8");
console.log(`Wrote catalog: ${catalogPath}`);

// ---------------------------------------------------------------------------
// 7. Write markdown overview
// ---------------------------------------------------------------------------
const md = [];
md.push("# MongoDB Atlas Admin API v2 — Overview");
md.push("");
md.push(
  "Auto-generated from the MongoDB Atlas Administration API OpenAPI 3.0 specification."
);
md.push("");
md.push(`- **Spec version:** ${specApiVersion}`);
md.push(`- **Generated:** ${catalog.generated}`);
md.push(
  `- **Source SHA:** \`${spec.info?.["x-xgen-sha"] || "unknown"}\``
);
md.push("");

md.push("## Summary");
md.push("");
md.push("| Metric | Count |");
md.push("|--------|------:|");
md.push(`| Endpoint paths | ${summary.total_paths} |`);
md.push(`| Total operations | ${summary.total_operations} |`);
md.push(`| Domains (PLAN.md) | ${summary.domains} |`);
md.push(`| Tags (mapped) | ${summary.tags_mapped} |`);
md.push(`| Tags (unmapped) | ${summary.tags_unmapped} |`);
md.push("");

md.push("## Authentication");
md.push("");
md.push(
  "The Atlas Admin API supports two authentication mechanisms:"
);
md.push("");
md.push(
  "1. **HTTP Digest Authentication** — provide a programmatic API public key and private key as username/password."
);
md.push(
  "2. **OAuth 2.0 Service Accounts** — use service account credentials to obtain a bearer token."
);
md.push("");
md.push(
  "All requests must include the `Accept` header with a versioned media type:"
);
md.push("```");
md.push("Accept: application/vnd.atlas.2025-03-12+json");
md.push("```");
md.push("");

md.push("## Pagination");
md.push("");
md.push(
  "List endpoints use cursor-based pagination with `pageNum`, `itemsPerPage`, and `includeCount` query parameters. " +
    "Responses include a `links` array with `rel: next` / `rel: previous` for navigation."
);
md.push("");

md.push("## Rate Limiting");
md.push("");
md.push(
  "The Atlas Admin API enforces rate limits of **100 requests per minute per project**. " +
    "Exceeding this returns HTTP `429 Too Many Requests`. Implement exponential backoff for retries."
);
md.push("");

md.push("---");
md.push("");

md.push("## Domains");
md.push("");

for (const [domainKey, domainDef] of Object.entries(domains)) {
  const domainOpCount = domainDef.tags.reduce(
    (sum, t) => sum + t.operation_count,
    0
  );
  md.push(`### ${domainDef.name}`);
  md.push("");
  md.push(`**${domainDef.tags.length} tag(s), ${domainOpCount} operation(s)**`);
  md.push("");
  md.push("| Tag | Ops | Key Operations |");
  md.push("|-----|----:|----------------|");

  for (const tag of domainDef.tags) {
    const keyOps = tag.operations
      .slice(0, 4)
      .map((op) => `\`${op.id}\``)
      .join(", ");
    const more = tag.operations.length > 4 ? ", ..." : "";
    md.push(`| ${tag.name} | ${tag.operation_count} | ${keyOps}${more} |`);
  }
  md.push("");
}

if (unmappedTags.length > 0) {
  md.push("### Unmapped Tags");
  md.push("");
  md.push(
    "The following tags exist in the OpenAPI spec but are not yet mapped to a PLAN.md domain:"
  );
  md.push("");
  md.push("| Tag | Ops |");
  md.push("|-----|----:|");
  for (const t of unmappedTags) {
    md.push(`| ${t.name} | ${t.operation_count} |`);
  }
  md.push("");
}

md.push("---");
md.push("");
md.push("## Full Catalog");
md.push("");
md.push(
  "See [`atlas-api-catalog.yaml`](atlas-api-catalog.yaml) for the complete structured endpoint catalog with all parameters, request body indicators, and response codes."
);
md.push("");

const mdPath = resolve(ROOT, "docs/ATLAS-API-OVERVIEW.md");
writeFileSync(mdPath, md.join("\n"), "utf-8");
console.log(`Wrote overview: ${mdPath}`);

// ---------------------------------------------------------------------------
// 8. Print summary to console
// ---------------------------------------------------------------------------
console.log("");
console.log("=== Atlas Admin API v2 — Parse Summary ===");
console.log(`  Paths:       ${summary.total_paths}`);
console.log(`  Operations:  ${summary.total_operations}`);
console.log(`  Tags total:  ${summary.tags_total}`);
console.log(`  Tags mapped: ${summary.tags_mapped}`);
console.log(`  Domains:     ${summary.domains}`);
if (unmappedTags.length > 0) {
  console.log(`  Unmapped:    ${unmappedTags.map((t) => t.name).join(", ")}`);
}
console.log("");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function refName(ref) {
  // "#/components/parameters/groupId" → "groupId"
  return ref.split("/").pop();
}

function extractPathParams(pathUrl) {
  const matches = pathUrl.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

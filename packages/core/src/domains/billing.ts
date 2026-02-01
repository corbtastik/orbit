import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const billingActions: ActionMap = {
  get_cost_explorer:          { method: "GET",  path: `${P}/orgs/{orgId}/billing/costExplorer/usage/{token}` },
  list_invoices:              { method: "GET",  path: `${P}/orgs/{orgId}/invoices` },
  list_pending:               { method: "GET",  path: `${P}/orgs/{orgId}/invoices/pending` },
  get_invoice:                { method: "GET",  path: `${P}/orgs/{orgId}/invoices/{invoiceId}` },
  get_invoice_csv:            { method: "GET",  path: `${P}/orgs/{orgId}/invoices/{invoiceId}/csv` },
  search_line_items:          { method: "GET",  path: `${P}/orgs/{orgId}/invoices/{invoiceId}/lineItems:search`, hasBody: true },
  list_skus:                  { method: "GET",  path: `${P}/skus` },
  get_sku:                    { method: "GET",  path: `${P}/skus/{skuId}` },
  create_cost_explorer_query: { method: "POST", path: `${P}/orgs/{orgId}/billing/costExplorer/usage`, hasBody: true },
};

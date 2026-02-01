import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const auditingActions: ActionMap = {
  get:    { method: "GET",   path: `${P}/groups/{groupId}/auditLog` },
  update: { method: "PATCH", path: `${P}/groups/{groupId}/auditLog`, hasBody: true },
};

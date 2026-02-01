import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const platformActions: ActionMap = {
  get_status:              { method: "GET", path: `${P}` },
  list_control_plane_ips:  { method: "GET", path: `${P}/unauth/controlPlaneIPAddresses` },
  get_project_activity:    { method: "GET", path: `${P}/groups/{groupId}/activityFeed` },
  get_org_activity:        { method: "GET", path: `${P}/orgs/{orgId}/activityFeed` },
};

import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const databaseUserActions: ActionMap = {
  list:   { method: "GET",    path: `${P}/groups/{groupId}/databaseUsers` },
  get:    { method: "GET",    path: `${P}/groups/{groupId}/databaseUsers/{databaseName}/{username}` },
  create: { method: "POST",   path: `${P}/groups/{groupId}/databaseUsers`, hasBody: true },
  update: { method: "PATCH",  path: `${P}/groups/{groupId}/databaseUsers/{databaseName}/{username}`, hasBody: true },
  delete: { method: "DELETE", path: `${P}/groups/{groupId}/databaseUsers/{databaseName}/{username}` },
};

export const customRoleActions: ActionMap = {
  list:   { method: "GET",    path: `${P}/groups/{groupId}/customDBRoles/roles` },
  get:    { method: "GET",    path: `${P}/groups/{groupId}/customDBRoles/roles/{roleName}` },
  create: { method: "POST",   path: `${P}/groups/{groupId}/customDBRoles/roles`, hasBody: true },
  update: { method: "PATCH",  path: `${P}/groups/{groupId}/customDBRoles/roles/{roleName}`, hasBody: true },
  delete: { method: "DELETE", path: `${P}/groups/{groupId}/customDBRoles/roles/{roleName}` },
};

export const ipAccessListActions: ActionMap = {
  list:       { method: "GET",    path: `${P}/groups/{groupId}/accessList` },
  get:        { method: "GET",    path: `${P}/groups/{groupId}/accessList/{entryValue}` },
  get_status: { method: "GET",    path: `${P}/groups/{groupId}/accessList/{entryValue}/status` },
  create:     { method: "POST",   path: `${P}/groups/{groupId}/accessList`, hasBody: true },
  delete:     { method: "DELETE", path: `${P}/groups/{groupId}/accessList/{entryValue}` },
};

export const networkPeeringActions: ActionMap = {
  list_containers:         { method: "GET",    path: `${P}/groups/{groupId}/containers` },
  list_containers_all:     { method: "GET",    path: `${P}/groups/{groupId}/containers/all` },
  get_container:           { method: "GET",    path: `${P}/groups/{groupId}/containers/{containerId}` },
  list_peers:              { method: "GET",    path: `${P}/groups/{groupId}/peers` },
  get_peer:                { method: "GET",    path: `${P}/groups/{groupId}/peers/{peerId}` },
  verify_private_ip_mode:  { method: "GET",    path: `${P}/groups/{groupId}/privateIpMode` },
  create_container:        { method: "POST",   path: `${P}/groups/{groupId}/containers`, hasBody: true },
  create_peer:             { method: "POST",   path: `${P}/groups/{groupId}/peers`, hasBody: true },
  update_container:        { method: "PATCH",  path: `${P}/groups/{groupId}/containers/{containerId}`, hasBody: true },
  update_peer:             { method: "PATCH",  path: `${P}/groups/{groupId}/peers/{peerId}`, hasBody: true },
  disable_private_ip_mode: { method: "PATCH",  path: `${P}/groups/{groupId}/privateIpMode`, hasBody: true },
  delete_container:        { method: "DELETE", path: `${P}/groups/{groupId}/containers/{containerId}` },
  delete_peer:             { method: "DELETE", path: `${P}/groups/{groupId}/peers/{peerId}` },
};

export const privateEndpointActions: ActionMap = {
  get_regional_mode:   { method: "GET",    path: `${P}/groups/{groupId}/privateEndpoint/regionalMode` },
  list_services:       { method: "GET",    path: `${P}/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService` },
  get_service:         { method: "GET",    path: `${P}/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}` },
  get_endpoint:        { method: "GET",    path: `${P}/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}/endpoint/{endpointId}` },
  create_service:      { method: "POST",   path: `${P}/groups/{groupId}/privateEndpoint/endpointService`, hasBody: true },
  create_endpoint:     { method: "POST",   path: `${P}/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}/endpoint`, hasBody: true },
  toggle_regional_mode:{ method: "PATCH",  path: `${P}/groups/{groupId}/privateEndpoint/regionalMode`, hasBody: true },
  delete_service:      { method: "DELETE", path: `${P}/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}` },
  delete_endpoint:     { method: "DELETE", path: `${P}/groups/{groupId}/privateEndpoint/{cloudProvider}/endpointService/{endpointServiceId}/endpoint/{endpointId}` },
  // Serverless private endpoints
  list_serverless:     { method: "GET",    path: `${P}/groups/{groupId}/privateEndpoint/serverless/instance/{instanceName}/endpoint` },
  get_serverless:      { method: "GET",    path: `${P}/groups/{groupId}/privateEndpoint/serverless/instance/{instanceName}/endpoint/{endpointId}` },
  create_serverless:   { method: "POST",   path: `${P}/groups/{groupId}/privateEndpoint/serverless/instance/{instanceName}/endpoint`, hasBody: true },
  update_serverless:   { method: "PATCH",  path: `${P}/groups/{groupId}/privateEndpoint/serverless/instance/{instanceName}/endpoint/{endpointId}`, hasBody: true },
  delete_serverless:   { method: "DELETE", path: `${P}/groups/{groupId}/privateEndpoint/serverless/instance/{instanceName}/endpoint/{endpointId}` },
};

export const authenticationActions: ActionMap = {
  // X.509
  list_x509_certs:       { method: "GET",    path: `${P}/groups/{groupId}/databaseUsers/{username}/certs` },
  create_x509_cert:      { method: "POST",   path: `${P}/groups/{groupId}/databaseUsers/{username}/certs`, hasBody: true },
  disable_custom_x509:   { method: "DELETE", path: `${P}/groups/{groupId}/userSecurity/customerX509` },
  // LDAP
  get_ldap:              { method: "GET",    path: `${P}/groups/{groupId}/userSecurity` },
  get_ldap_verify_status:{ method: "GET",    path: `${P}/groups/{groupId}/userSecurity/ldap/verify/{requestId}` },
  verify_ldap:           { method: "POST",   path: `${P}/groups/{groupId}/userSecurity/ldap/verify`, hasBody: true },
  update_ldap:           { method: "PATCH",  path: `${P}/groups/{groupId}/userSecurity`, hasBody: true },
  delete_ldap_mapping:   { method: "DELETE", path: `${P}/groups/{groupId}/userSecurity/ldap/userToDNMapping` },
  // Federated Authentication
  list_federation_orgs:              { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs` },
  get_federation_org:                { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}` },
  list_role_mappings:                { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}/roleMappings` },
  get_role_mapping:                  { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}/roleMappings/{id}` },
  list_identity_providers:           { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/identityProviders` },
  get_identity_provider:             { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/identityProviders/{identityProviderId}` },
  get_identity_provider_metadata:    { method: "GET",    path: `${P}/federationSettings/{federationSettingsId}/identityProviders/{identityProviderId}/metadata.xml` },
  get_federation_settings:           { method: "GET",    path: `${P}/orgs/{orgId}/federationSettings` },
  create_role_mapping:               { method: "POST",   path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}/roleMappings`, hasBody: true },
  create_identity_provider:          { method: "POST",   path: `${P}/federationSettings/{federationSettingsId}/identityProviders`, hasBody: true },
  update_role_mapping:               { method: "PUT",    path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}/roleMappings/{id}`, hasBody: true },
  update_federation_org:             { method: "PATCH",  path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}`, hasBody: true },
  update_identity_provider:          { method: "PATCH",  path: `${P}/federationSettings/{federationSettingsId}/identityProviders/{identityProviderId}`, hasBody: true },
  delete_federation:                 { method: "DELETE", path: `${P}/federationSettings/{federationSettingsId}` },
  remove_federation_org:             { method: "DELETE", path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}` },
  delete_role_mapping:               { method: "DELETE", path: `${P}/federationSettings/{federationSettingsId}/connectedOrgConfigs/{orgId}/roleMappings/{id}` },
  delete_identity_provider:          { method: "DELETE", path: `${P}/federationSettings/{federationSettingsId}/identityProviders/{identityProviderId}` },
  revoke_identity_provider_jwks:     { method: "DELETE", path: `${P}/federationSettings/{federationSettingsId}/identityProviders/{identityProviderId}/jwks` },
};

export const cloudProviderAccessActions: ActionMap = {
  list:        { method: "GET",    path: `${P}/groups/{groupId}/cloudProviderAccess` },
  get:         { method: "GET",    path: `${P}/groups/{groupId}/cloudProviderAccess/{roleId}` },
  create:      { method: "POST",   path: `${P}/groups/{groupId}/cloudProviderAccess`, hasBody: true },
  authorize:   { method: "PATCH",  path: `${P}/groups/{groupId}/cloudProviderAccess/{roleId}`, hasBody: true },
  deauthorize: { method: "DELETE", path: `${P}/groups/{groupId}/cloudProviderAccess/{cloudProvider}/{roleId}` },
};

export const encryptionActions: ActionMap = {
  get:                      { method: "GET",    path: `${P}/groups/{groupId}/encryptionAtRest` },
  list_private_endpoints:   { method: "GET",    path: `${P}/groups/{groupId}/encryptionAtRest/{cloudProvider}/privateEndpoints` },
  get_private_endpoint:     { method: "GET",    path: `${P}/groups/{groupId}/encryptionAtRest/{cloudProvider}/privateEndpoints/{endpointId}` },
  create_private_endpoint:  { method: "POST",   path: `${P}/groups/{groupId}/encryptionAtRest/{cloudProvider}/privateEndpoints`, hasBody: true },
  update:                   { method: "PATCH",  path: `${P}/groups/{groupId}/encryptionAtRest`, hasBody: true },
  delete_private_endpoint:  { method: "DELETE", path: `${P}/groups/{groupId}/encryptionAtRest/{cloudProvider}/privateEndpoints/{endpointId}` },
};

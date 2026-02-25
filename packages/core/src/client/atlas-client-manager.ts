import { AtlasClient } from "./atlas-client.js";
import type { ResolvedOrbitConfig, ResolvedAtlasProfile } from "../config/index.js";

/**
 * Manages multiple AtlasClient instances for multi-profile support.
 *
 * Enables cross-organization operations by allowing tools to specify
 * which Atlas profile (credentials) to use for each request.
 */
export class AtlasClientManager {
  private readonly clients: Map<string, AtlasClient> = new Map();
  private readonly defaultProfile: string;

  /**
   * Create a manager from resolved config.
   * Creates an AtlasClient for each configured profile.
   */
  constructor(config: ResolvedOrbitConfig) {
    this.defaultProfile = config.atlas.default;

    for (const [name, profile] of Object.entries(config.atlas.profiles)) {
      this.clients.set(name, this.createClient(profile));
    }
  }

  /**
   * Get a client for the specified profile.
   * If no profile is specified, returns the default profile's client.
   *
   * @param profile - Profile name, or undefined for default
   * @returns AtlasClient for the profile
   * @throws Error if profile not found
   */
  getClient(profile?: string): AtlasClient {
    const profileName = profile ?? this.defaultProfile;
    const client = this.clients.get(profileName);

    if (!client) {
      const available = this.listProfiles().join(", ") || "(none)";
      throw new Error(
        `Atlas profile "${profileName}" not found. Available profiles: ${available}`,
      );
    }

    return client;
  }

  /**
   * Check if a profile exists.
   */
  hasProfile(profile: string): boolean {
    return this.clients.has(profile);
  }

  /**
   * Get the default profile name.
   */
  getDefaultProfileName(): string {
    return this.defaultProfile;
  }

  /**
   * List all available profile names.
   */
  listProfiles(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if any profiles are configured.
   */
  hasAnyProfile(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Create an AtlasClient from a profile.
   */
  private createClient(profile: ResolvedAtlasProfile): AtlasClient {
    return new AtlasClient({
      publicKey: profile.publicKey,
      privateKey: profile.privateKey,
      orgId: profile.orgId,
      groupId: profile.groupId,
      baseUrl: profile.baseUrl,
    });
  }
}

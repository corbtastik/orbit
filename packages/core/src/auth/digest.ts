import { createHash } from "node:crypto";

/**
 * HTTP Digest Authentication helper for the Atlas Admin API.
 *
 * Atlas uses standard RFC 7616 Digest auth. The flow is:
 * 1. Client sends request without credentials.
 * 2. Server responds 401 with WWW-Authenticate header containing nonce, realm, qop.
 * 3. Client re-sends the request with an Authorization header computed from the challenge.
 *
 * This module handles step 3 — given a WWW-Authenticate challenge, it computes the
 * correct Authorization header value.
 */

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop: string;
  algorithm?: string;
  opaque?: string;
}

let nonceCount = 0;

/**
 * Parse a WWW-Authenticate: Digest header into its components.
 */
export function parseDigestChallenge(header: string): DigestChallenge {
  const params: Record<string, string> = {};
  // Match key="value" or key=value patterns
  const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }

  return {
    realm: params.realm ?? "",
    nonce: params.nonce ?? "",
    qop: params.qop ?? "auth",
    algorithm: params.algorithm,
    opaque: params.opaque,
  };
}

/**
 * Compute the Digest Authorization header value for a request.
 */
export function computeDigestAuth(
  username: string,
  password: string,
  method: string,
  uri: string,
  challenge: DigestChallenge,
): string {
  nonceCount++;
  const nc = nonceCount.toString(16).padStart(8, "0");
  const cnonce = createHash("md5")
    .update(Date.now().toString() + Math.random().toString())
    .digest("hex")
    .slice(0, 16);

  const algorithm = challenge.algorithm ?? "MD5";
  const hashFn = (data: string) =>
    createHash("md5").update(data).digest("hex");

  const ha1 = hashFn(`${username}:${challenge.realm}:${password}`);
  const ha2 = hashFn(`${method}:${uri}`);

  let response: string;
  if (challenge.qop === "auth" || challenge.qop === "auth-int") {
    response = hashFn(
      `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`,
    );
  } else {
    response = hashFn(`${ha1}:${challenge.nonce}:${ha2}`);
  }

  const parts = [
    `Digest username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `algorithm=${algorithm}`,
    `response="${response}"`,
    `qop=${challenge.qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`,
  ];

  if (challenge.opaque) {
    parts.push(`opaque="${challenge.opaque}"`);
  }

  return parts.join(", ");
}

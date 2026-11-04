/**
 * Cloudflare Workers-compatible Firebase Admin REST client.
 *
 * Why this exists: firebase-admin uses google-auth-library which calls
 * new Function() internally for JWT handling — this throws an EvalError
 * in the Cloudflare Workers V8 isolate (which bans dynamic code generation).
 *
 * This module reimplements the minimum needed surface using only:
 *   - Web Crypto API (SubtleCrypto) for RSA-SHA256 JWT signing — no eval
 *   - fetch() for all HTTP calls
 *   - Firestore REST API
 *
 * Required env vars (set as Cloudflare Worker secrets):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   (PEM, literal \n chars accepted)
 */

// ─── JWT / Auth ───────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

/** Cache access tokens to avoid re-signing on every request. */
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

/**
 * Import a PEM-encoded RSA private key using the Web Crypto API.
 * Cloudflare Workers supports SubtleCrypto — no Node.js crypto needed.
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pem = pemKey
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(data: string | Uint8Array): string {
  const str =
    typeof data === "string"
      ? data
      : String.fromCharCode(...(data as Uint8Array));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Fetch a short-lived OAuth2 access token for the given scope.
 * Signs a service-account JWT using the Web Crypto API (no eval).
 * Caches the token for its lifetime minus a 60-second buffer.
 */
export async function getAccessToken(scope = FIRESTORE_SCOPE): Promise<string> {
  const cached = tokenCache[scope];
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? "";
  const privateKeyPem = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: GOOGLE_TOKEN_URL,
      scope,
      iat: now,
      exp: now + 3600,
    })
  );

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(privateKeyPem);
  const signatureBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const signature = base64url(new Uint8Array(signatureBytes));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get access token (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache[scope] = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

// ─── Firestore REST helpers ───────────────────────────────────────────────────

function firestoreBase(): string {
  const project = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "";
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
}

/** Convert a Firestore REST document value to a plain JS value. */
function fromFirestoreValue(val: Record<string, unknown>): unknown {
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return val.doubleValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("nullValue" in val) return null;
  if ("timestampValue" in val) return val.timestampValue;
  if ("arrayValue" in val) {
    const arr = val.arrayValue as { values?: Record<string, unknown>[] };
    return (arr.values ?? []).map(fromFirestoreValue);
  }
  if ("mapValue" in val) {
    const map = val.mapValue as { fields?: Record<string, Record<string, unknown>> };
    return fromFirestoreFields(map.fields ?? {});
  }
  return undefined;
}

/** Convert Firestore REST fields object to a plain JS object. */
export function fromFirestoreFields(
  fields: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v);
  }
  return out;
}

/** Convert a plain JS value to a Firestore REST value object. */
function toFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val))
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === "object") {
    const fields: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v) as Record<string, unknown>;
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/** Convert a plain object to Firestore REST fields. */
function toFirestoreFields(
  obj: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  const fields: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v) as Record<string, unknown>;
  }
  return fields;
}

export interface FirestoreDoc {
  id: string;
  data: Record<string, unknown>;
}

/** Fetch all documents from a collection (handles pagination). */
export async function firestoreGetCollection(
  collection: string
): Promise<FirestoreDoc[]> {
  const token = await getAccessToken();
  const docs: FirestoreDoc[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${firestoreBase()}/${collection}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore GET ${collection} failed (${res.status}): ${text}`);
    }

    const body = (await res.json()) as {
      documents?: Array<{
        name: string;
        fields?: Record<string, Record<string, unknown>>;
      }>;
      nextPageToken?: string;
    };

    for (const doc of body.documents ?? []) {
      const id = doc.name.split("/").pop() ?? "";
      docs.push({ id, data: fromFirestoreFields(doc.fields ?? {}) });
    }

    pageToken = body.nextPageToken;
  } while (pageToken);

  return docs;
}

export interface FirestoreFilter {
  field: string;
  op:
    | "EQUAL"
    | "NOT_EQUAL"
    | "LESS_THAN"
    | "LESS_THAN_OR_EQUAL"
    | "GREATER_THAN"
    | "GREATER_THAN_OR_EQUAL"
    | "ARRAY_CONTAINS"
    | "IN"
    | "NOT_IN";
  value: unknown;
}

/** Run a structured Firestore query with one or more filters. */
export async function firestoreQuery(
  collection: string,
  filters: FirestoreFilter[],
  selectFields?: string[],
  limit?: number
): Promise<FirestoreDoc[]> {
  const token = await getAccessToken();

  const buildSingle = (f: FirestoreFilter) => ({
    fieldFilter: {
      field: { fieldPath: f.field },
      op: f.op,
      value: toFirestoreValue(f.value),
    },
  });

  const queryFilter =
    filters.length === 1
      ? buildSingle(filters[0])
      : {
          compositeFilter: {
            op: "AND",
            filters: filters.map(buildSingle),
          },
        };

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection }],
    where: queryFilter,
  };
  if (selectFields?.length) {
    structuredQuery.select = {
      fields: selectFields.map((f) => ({ fieldPath: f })),
    };
  }
  if (limit !== undefined) {
    structuredQuery.limit = limit;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "";
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore query ${collection} failed (${res.status}): ${text}`);
  }

  const rows = (await res.json()) as Array<{
    document?: {
      name: string;
      fields?: Record<string, Record<string, unknown>>;
    };
  }>;

  return rows
    .filter((r) => r.document)
    .map((r) => ({
      id: r.document!.name.split("/").pop() ?? "",
      data: fromFirestoreFields(r.document!.fields ?? {}),
    }));
}

/** Set (create/overwrite) or merge-patch a document. */
export async function firestoreSet(
  docPath: string,
  data: Record<string, unknown>,
  merge = false
): Promise<void> {
  const token = await getAccessToken();
  const fields = toFirestoreFields(data);

  let url = `${firestoreBase()}/${docPath}`;
  if (merge) {
    const fieldPaths = Object.keys(data)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join("&");
    url = `${url}?${fieldPaths}`;
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore SET ${docPath} failed (${res.status}): ${text}`);
  }
}

/** Update specific fields on a document (merge patch). */
export async function firestoreUpdate(
  docPath: string,
  data: Record<string, unknown>
): Promise<void> {
  return firestoreSet(docPath, data, true);
}

export interface BatchWrite {
  type: "set" | "update";
  /** Path relative to /documents, e.g. "profiles/uid123" */
  docPath: string;
  data: Record<string, unknown>;
}

/** Commit up to 500 writes in a single batchWrite request. */
export async function firestoreBatchWrite(writes: BatchWrite[]): Promise<void> {
  if (writes.length === 0) return;
  const token = await getAccessToken();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? "";
  const dbPath = `projects/${projectId}/databases/(default)`;

  const restWrites = writes.map((w) => {
    const name = `${dbPath}/documents/${w.docPath}`;
    const fields = toFirestoreFields(w.data);
    if (w.type === "update") {
      return {
        update: { name, fields },
        updateMask: { fieldPaths: Object.keys(w.data) },
      };
    }
    return { update: { name, fields } };
  });

  const url = `https://firestore.googleapis.com/v1/${dbPath}/documents:batchWrite`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes: restWrites }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore batchWrite failed (${res.status}): ${text}`);
  }
}

/** Create a new document in a collection (server-generated ID). Returns the new doc ID. */
export async function firestoreCreate(
  collection: string,
  data: Record<string, unknown>
): Promise<string> {
  const token = await getAccessToken();
  const url = `${firestoreBase()}/${collection}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore CREATE ${collection} failed (${res.status}): ${text}`);
  }

  const doc = (await res.json()) as { name: string };
  return doc.name.split("/").pop() ?? "";
}

import { createSign } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function parseServiceAccount(): ServiceAccount | null {
  const { fcm } = getServerConfig();
  if (!fcm.serviceAccountJson) return null;
  try {
    return JSON.parse(fcm.serviceAccountJson) as ServiceAccount;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  const sa = parseServiceAccount();
  if (!sa) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(sa.private_key, "base64url");
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  cachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

export async function sendFcmV1Message(input: {
  token: string;
  title: string;
  body: string;
  projectId: string;
}): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("FCM v1 credentials not configured");

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${input.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: input.token,
          notification: { title: input.title, body: input.body },
        },
      }),
    },
  );

  const text = await res.text();
  let body: { name?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  if (!res.ok) throw new Error(`FCM v1 ${res.status}: ${text.slice(0, 200)}`);
  return { messageId: body.name ?? "sent" };
}

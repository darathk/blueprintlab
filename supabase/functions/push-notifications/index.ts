// Supabase Edge Function: push-notifications
//
// Triggered by a Database Webhook on INSERT into the "Message" table.
//
// SETUP:
//   1. Deploy:
//        supabase functions deploy push-notifications
//
//   2. Set secrets:
//        supabase secrets set VAPID_PUBLIC_KEY=<base64url-65-byte-uncompressed-public-key>
//        supabase secrets set VAPID_PRIVATE_KEY=<base64url-32-byte-private-key>
//        supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//
//   3. Create Database Webhook (Supabase Dashboard → Database → Webhooks):
//        Table: Message | Events: INSERT
//        Type: Supabase Edge Function | Function: push-notifications
//
//   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase.
//
// HOW IT WORKS:
//   Webhook fires → this function receives the new Message row →
//   looks up receiver's PushSubscription(s) → encrypts payload per
//   RFC 8291 (aes128gcm) using Web Crypto → POSTs to each push endpoint
//   with VAPID authorization header.
//
//   No npm dependencies — all crypto is done via Deno's Web Crypto API
//   which is required for Supabase Edge Functions (no Node.js built-ins).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════
// Base64url helpers
// ═══════════════════════════════════════════════════════════════

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ═══════════════════════════════════════════════════════════════
// VAPID: Import private key & sign JWT
// ═══════════════════════════════════════════════════════════════

// Web Crypto cannot import a raw 32-byte EC private key directly.
// We wrap it in a minimal PKCS8 DER envelope for P-256 / prime256v1.
//
//   SEQUENCE {
//     INTEGER 0                          -- version
//     SEQUENCE { OID ecPublicKey, OID prime256v1 }  -- algorithm
//     OCTET STRING {
//       SEQUENCE { INTEGER 1, OCTET STRING <32 bytes> }  -- ECPrivateKey
//     }
//   }
const PKCS8_P256_HEAD = new Uint8Array([
  0x30, 0x41, 0x02, 0x01, 0x00,
  0x30, 0x13,
  0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
  0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
]);

async function importVapidPrivateKey(b64Key: string): Promise<CryptoKey> {
  const raw = b64urlDecode(b64Key);
  if (raw.length !== 32) {
    throw new Error(`VAPID private key must be 32 bytes, got ${raw.length}`);
  }
  const pkcs8 = new Uint8Array(PKCS8_P256_HEAD.length + 32);
  pkcs8.set(PKCS8_P256_HEAD);
  pkcs8.set(raw, PKCS8_P256_HEAD.length);

  return crypto.subtle.importKey(
    "pkcs8", pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"],
  );
}

// Sign a VAPID JWT (ES256) for the given push service audience.
async function signVapidJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
): Promise<string> {
  const te = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(te.encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  })));
  const unsigned = `${header}.${payload}`;

  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      te.encode(unsigned),
    ),
  );

  // Web Crypto may return DER-encoded ECDSA sig — normalize to raw r||s (64 bytes)
  return `${unsigned}.${b64url(sig.length === 64 ? sig : derSigToRaw(sig))}`;
}

// Convert a DER-encoded ECDSA signature to the 64-byte r||s format
// that the VAPID Authorization header expects.
function derSigToRaw(der: Uint8Array): Uint8Array {
  // DER layout: 0x30 <totalLen> 0x02 <rLen> <r...> 0x02 <sLen> <s...>
  let i = 2;
  i++; // 0x02 tag for r
  const rLen = der[i++];
  let r = der.slice(i, i + rLen);
  i += rLen;
  i++; // 0x02 tag for s
  const sLen = der[i++];
  let s = der.slice(i, i + sLen);

  // Strip leading zero-pad or zero-pad to exactly 32 bytes
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

// ═══════════════════════════════════════════════════════════════
// RFC 8291 Push Message Encryption (aes128gcm)
// ═══════════════════════════════════════════════════════════════

// HKDF-SHA256 (single-expand, ≤32 bytes output — sufficient for push)
// Extract: PRK = HMAC-SHA256(salt, IKM)
// Expand:  OKM = HMAC-SHA256(PRK, info || 0x01)  (first block only)
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Extract
  const saltKey = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

  // Expand (single block — length ≤ 32)
  const prkKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const expandInput = new Uint8Array(info.length + 1);
  expandInput.set(info);
  expandInput[info.length] = 1;
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, expandInput));
  return okm.slice(0, length);
}

// Encrypt a push message payload per RFC 8291.
// Returns the complete HTTP body (aes128gcm header + ciphertext).
async function encryptPushPayload(
  p256dh: string,
  authSecret: string,
  plaintext: string,
): Promise<Uint8Array> {
  const te = new TextEncoder();

  // 1. Generate ephemeral ECDH server key pair
  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  ) as CryptoKeyPair;
  const serverPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKP.publicKey),
  );

  // 2. Import client's p256dh public key
  const clientPubBytes = b64urlDecode(p256dh);
  const clientPub = await crypto.subtle.importKey(
    "raw", clientPubBytes,
    { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  // 3. ECDH shared secret
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPub },
      serverKP.privateKey, 256,
    ),
  );

  // 4. Derive input keying material (IKM)
  //    IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const authBytes = b64urlDecode(authSecret);
  const infoPrefix = te.encode("WebPush: info\0");
  const ikmInfo = new Uint8Array(infoPrefix.length + clientPubBytes.length + serverPub.length);
  ikmInfo.set(infoPrefix, 0);
  ikmInfo.set(clientPubBytes, infoPrefix.length);
  ikmInfo.set(serverPub, infoPrefix.length + clientPubBytes.length);
  const ikm = await hkdf(authBytes, ecdhSecret, ikmInfo, 32);

  // 5. Derive CEK (16 bytes) and nonce (12 bytes) from IKM + random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);

  // 6. Pad plaintext: data || 0x02 (single-record delimiter per RFC 8188)
  const ptBytes = te.encode(plaintext);
  const padded = new Uint8Array(ptBytes.length + 1);
  padded.set(ptBytes);
  padded[ptBytes.length] = 0x02;

  // 7. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  // 8. Build aes128gcm body: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPub.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize);
  header[20] = serverPub.length;
  header.set(serverPub, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header);
  body.set(ciphertext, header.length);
  return body;
}

// ═══════════════════════════════════════════════════════════════
// Send push notification to a single subscription endpoint
// ═══════════════════════════════════════════════════════════════

interface PushResult {
  ok: boolean;
  status?: number;
  error?: string;
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<PushResult> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const privKey = await importVapidPrivateKey(vapidPrivateKey);
    const jwt = await signVapidJwt(audience, vapidSubject, privKey);
    const body = await encryptPushPayload(p256dh, auth, payload);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(body.length),
        "TTL": "3600",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body,
    });

    if (res.status === 201 || res.status === 200) {
      return { ok: true, status: res.status };
    }
    const errText = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: errText };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════
// Edge Function Handler
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // ── Parse webhook payload ──
    // Supabase Database Webhook sends: { type: "INSERT", table: "Message", record: { ... } }
    const webhook = await req.json();
    const record = webhook.record;

    if (!record) {
      return Response.json({ error: "No record in webhook payload" }, { status: 400 });
    }

    // Column names match Prisma's Message model (camelCase by default)
    const { senderId, receiverId, content, mediaUrl, mediaType } = record;

    if (!senderId || !receiverId) {
      return Response.json({ error: "Missing senderId or receiverId" }, { status: 400 });
    }

    // Skip self-messages
    if (senderId === receiverId) {
      return Response.json({ skipped: true, reason: "self-message" });
    }

    // ── Load secrets ──
    const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const VAPID_SUB = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@blueprintlab.app";
    const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!VAPID_PUB || !VAPID_PRIV) {
      console.error("[push] VAPID keys not set — run: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...");
      return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    // ── Query database ──
    const supabase = createClient(SB_URL, SB_KEY);

    // Fetch sender name, receiver info, and receiver's push subscriptions in parallel
    const [senderRes, receiverRes, subsRes] = await Promise.all([
      supabase.from("Athlete").select("name").eq("id", senderId).single(),
      supabase.from("Athlete").select("id, role, email").eq("id", receiverId).single(),
      supabase.from("PushSubscription").select("id, endpoint, p256dh, auth").eq("athleteId", receiverId),
    ]);

    const subs = subsRes.data;
    if (!subs || subs.length === 0) {
      console.log(`[push] No push subscriptions for receiver ${receiverId}`);
      return Response.json({ skipped: true, reason: "no subscriptions" });
    }

    // ── Build notification payload ──
    const receiver = receiverRes.data;
    const senderName = senderRes.data?.name ?? "New Message";

    // Determine redirect URL based on receiver's role
    const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
    const isReceiverCoach =
      receiver?.role === "coach" ||
      (adminEmail && receiver?.email?.toLowerCase() === adminEmail.toLowerCase());

    const notifUrl = isReceiverCoach
      ? `/dashboard/messages?athleteId=${senderId}`
      : `/athlete/${receiverId}/chat`;

    // Truncate or describe the message content
    const notifBody = content?.trim()
      ? (content.length > 50 ? content.substring(0, 47) + "..." : content)
      : mediaUrl
        ? (mediaType?.startsWith("video") ? "Sent a video"
          : mediaType?.startsWith("audio") ? "Sent a voice message"
          : "Sent a photo")
        : "New message";

    const payload = JSON.stringify({
      title: senderName,
      body: notifBody,
      url: notifUrl,
    });

    console.log(`[push] Sending to ${subs.length} device(s) for ${receiver?.email ?? receiverId}`);

    // ── Send to all devices in parallel ──
    const results = await Promise.allSettled(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        const result = await sendWebPush(
          sub.endpoint, sub.p256dh, sub.auth,
          payload,
          VAPID_PUB, VAPID_PRIV, VAPID_SUB,
        );

        // Auto-clean stale subscriptions (410 Gone = expired, 404 = deleted)
        if (!result.ok && (result.status === 410 || result.status === 404)) {
          console.log(`[push] Removing stale subscription ${sub.id} (${result.status})`);
          await supabase.from("PushSubscription").delete().eq("id", sub.id);
        }

        return result;
      }),
    );

    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && (r.value as PushResult).ok,
    ).length;
    const failed = results.length - succeeded;

    console.log(`[push] Done: ${succeeded} delivered, ${failed} failed out of ${results.length}`);

    return Response.json({
      success: true,
      delivered: succeeded,
      failed,
      total: results.length,
    });
  } catch (err) {
    console.error("[push] Unhandled error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});

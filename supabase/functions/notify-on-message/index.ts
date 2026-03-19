// Supabase Edge Function: notify-on-message
//
// Triggered by a Database Webhook on INSERT into the "Message" table.
//
// SETUP:
//   1. Deploy:  supabase functions deploy notify-on-message
//   2. Set secrets:
//        supabase secrets set VAPID_PUBLIC_KEY=<base64url-encoded-65-byte-public-key>
//        supabase secrets set VAPID_PRIVATE_KEY=<base64url-encoded-32-byte-private-key>
//        supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   3. Create Database Webhook in Supabase Dashboard → Database → Webhooks:
//        Table: Message | Events: INSERT | Type: Supabase Edge Function
//        Function: notify-on-message
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Base64url helpers ───

function b64url(data: Uint8Array): string {
  let b = "";
  for (const byte of data) b += String.fromCharCode(byte);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── VAPID private key import via PKCS8 wrapper ───
// Web Crypto can't import raw EC private keys, so we wrap the 32-byte
// scalar in a minimal PKCS8 DER envelope for P-256.

const PKCS8_P256_PREFIX = new Uint8Array([
  0x30, 0x41, 0x02, 0x01, 0x00,                               // SEQUENCE { version 0
  0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, // AlgId {
  0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, //   ecPublicKey, P-256
  0x07,                                                         // }
  0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,       // OCTET { ECPrivateKey { v1, key:
]);

async function importVapidKey(base64Key: string): Promise<CryptoKey> {
  const raw = b64urlDecode(base64Key);
  const pkcs8 = new Uint8Array(PKCS8_P256_PREFIX.length + raw.length);
  pkcs8.set(PKCS8_P256_PREFIX);
  pkcs8.set(raw, PKCS8_P256_PREFIX.length);

  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

// ─── VAPID JWT (ES256) ───

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey
): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  })));

  const unsigned = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      enc.encode(unsigned)
    )
  );

  // Web Crypto may return DER-encoded signature — convert to raw r||s (64 bytes)
  const rawSig = sig.length === 64 ? sig : derToRaw(sig);
  return `${unsigned}.${b64url(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  let i = 2; // skip SEQUENCE tag + length
  i++; // 0x02
  const rLen = der[i++];
  let r = der.slice(i, i + rLen);
  i += rLen;
  i++; // 0x02
  const sLen = der[i++];
  let s = der.slice(i, i + sLen);

  // Trim leading zero padding / pad to 32 bytes
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

// ─── RFC 8291 Push Encryption (aes128gcm) ───

async function hkdfSha256(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  len: number
): Promise<Uint8Array> {
  // Extract: PRK = HMAC-SHA256(salt, IKM)
  const saltKey = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

  // Expand: OKM = HMAC-SHA256(PRK, info || 0x01)
  const prkKey = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const buf = new Uint8Array(info.length + 1);
  buf.set(info);
  buf[info.length] = 1;
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, buf));
  return okm.slice(0, len);
}

async function encryptPayload(
  p256dh: string,
  auth: string,
  plaintext: string
): Promise<{ body: Uint8Array }> {
  const enc = new TextEncoder();

  // Ephemeral ECDH key pair
  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  ) as CryptoKeyPair;

  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKP.publicKey)
  );

  // Import subscriber's p256dh public key
  const clientPub = await crypto.subtle.importKey(
    "raw", b64urlDecode(p256dh),
    { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPub },
      serverKP.privateKey,
      256
    )
  );

  const authSecret = b64urlDecode(auth);
  const clientPubRaw = b64urlDecode(p256dh);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive IKM: HKDF-Extract(auth_secret, shared_secret) then Expand with "WebPush: info\0" || client || server
  const webpushInfo = new Uint8Array(
    enc.encode("WebPush: info\0").length + clientPubRaw.length + serverPubRaw.length
  );
  webpushInfo.set(enc.encode("WebPush: info\0"), 0);
  webpushInfo.set(clientPubRaw, enc.encode("WebPush: info\0").length);
  webpushInfo.set(serverPubRaw, enc.encode("WebPush: info\0").length + clientPubRaw.length);

  const ikm = await hkdfSha256(authSecret, sharedSecret, webpushInfo, 32);

  // Derive Content Encryption Key (16 bytes) and Nonce (12 bytes)
  const cek = await hkdfSha256(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfSha256(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // Pad plaintext with 0x02 delimiter (RFC 8188)
  const data = enc.encode(plaintext);
  const padded = new Uint8Array(data.length + 1);
  padded.set(data);
  padded[data.length] = 2;

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  // Build aes128gcm body: salt(16) | rs(4) | idlen(1) | keyid(65) | ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPubRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = serverPubRaw.length;
  header.set(serverPubRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header);
  body.set(ciphertext, header.length);

  return { body };
}

// ─── Send push to one subscription ───

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPub: string,
  vapidPriv: string,
  vapidSubject: string
): Promise<{ ok: boolean; status?: number; err?: string }> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const privKey = await importVapidKey(vapidPriv);
    const jwt = await createVapidJwt(audience, vapidSubject, privKey);
    const { body } = await encryptPayload(p256dh, auth, payload);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(body.length),
        TTL: "3600",
        Authorization: `vapid t=${jwt}, k=${vapidPub}`,
      },
      body,
    });

    if (res.status === 201 || res.status === 200) return { ok: true, status: res.status };
    return { ok: false, status: res.status, err: await res.text().catch(() => "") };
  } catch (e) {
    return { ok: false, err: String(e) };
  }
}

// ─── Handler ───

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const webhook = await req.json();
    const record = webhook.record;

    if (!record) return json({ error: "No record in payload" }, 400);

    const { senderId, receiverId, content, mediaUrl, mediaType } = record;
    if (!senderId || !receiverId) return json({ error: "Missing sender/receiver" }, 400);
    if (senderId === receiverId) return json({ skipped: "self-message" });

    // Environment (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are auto-injected)
    const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const VAPID_SUB = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@blueprintlab.app";
    const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!VAPID_PUB || !VAPID_PRIV) {
      console.error("[notify] VAPID keys not configured");
      return json({ error: "VAPID not configured" }, 500);
    }

    const supabase = createClient(SB_URL, SB_KEY);

    // Parallel: fetch sender name + receiver info + receiver subscriptions
    const [senderRes, receiverRes, subsRes] = await Promise.all([
      supabase.from("Athlete").select("name").eq("id", senderId).single(),
      supabase.from("Athlete").select("id, role, email").eq("id", receiverId).single(),
      supabase.from("PushSubscription").select("id, endpoint, p256dh, auth").eq("athleteId", receiverId),
    ]);

    const subs = subsRes.data;
    if (!subs || subs.length === 0) {
      console.log(`[notify] No subscriptions for ${receiverId}`);
      return json({ skipped: "no subscriptions" });
    }

    // Build notification payload
    const receiver = receiverRes.data;
    const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
    const isCoach = receiver?.role === "coach" ||
      (adminEmail && receiver?.email?.toLowerCase() === adminEmail.toLowerCase());

    const redirectUrl = isCoach
      ? `/dashboard/messages?athleteId=${senderId}`
      : `/athlete/${receiverId}/chat`;

    const body = content?.trim()
      ? content.length > 50 ? content.substring(0, 47) + "..." : content
      : mediaUrl
        ? mediaType?.startsWith("video") ? "Video"
          : mediaType?.startsWith("audio") ? "Voice Message"
          : "Photo"
        : "New message";

    const payload = JSON.stringify({
      title: senderRes.data?.name ?? "New Message",
      body,
      url: redirectUrl,
    });

    console.log(`[notify] Sending to ${subs.length} device(s) for ${receiver?.email ?? receiverId}`);

    // Send to all devices in parallel
    const results = await Promise.allSettled(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        const r = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload, VAPID_PUB, VAPID_PRIV, VAPID_SUB);

        // Remove stale subscriptions (410 Gone / 404 Not Found)
        if (!r.ok && (r.status === 410 || r.status === 404)) {
          await supabase.from("PushSubscription").delete().eq("id", sub.id);
          console.log(`[notify] Removed stale subscription ${sub.id}`);
        }

        return r;
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok
    ).length;

    console.log(`[notify] ${sent}/${results.length} delivered`);
    return json({ success: true, sent, total: results.length });
  } catch (err) {
    console.error("[notify] Error:", err);
    return json({ error: String(err) }, 500);
  }
});

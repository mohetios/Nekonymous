import type { CipherEnvelope } from "../types";

/**
 * Product crypto helpers: callback capabilities, encrypted small payloads,
 * chat-id sealing, and stable private peer tags for anonymous relay routing.
 */
const GCM_IV_BYTES = 12;
const SENDER_ALIAS_BITS = 128;
const MASTER_KID = "master:v1";

const AES_INFO = new TextEncoder().encode("nekonymous:aes:v1");
const CHAT_INFO = new TextEncoder().encode("nekonymous:chat:v1");
const HMAC_INFO = new TextEncoder().encode("nekonymous:tg-user:v1");
const LOOKUP_INFO = "lookup:v1:";
const DEDUPE_INFO = "dedupe:v1:";
const BLOCK_INFO = "block:v1:";

const textEncoder = new TextEncoder();

export const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const importHkdfKey = (keyMaterial: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyMaterial),
    "HKDF",
    false,
    ["deriveKey", "deriveBits"]
  );

let cachedHkdfKey: CryptoKey | null = null;
let cachedHkdfKeySource: string | null = null;

const getHkdfKeyMaterial = async (keyMaterial: string): Promise<CryptoKey> => {
  if (cachedHkdfKey && cachedHkdfKeySource === keyMaterial) {
    return cachedHkdfKey;
  }

  cachedHkdfKey = await importHkdfKey(keyMaterial);
  cachedHkdfKeySource = keyMaterial;
  return cachedHkdfKey;
};

const hkdfParams = (salt: Uint8Array, info: Uint8Array) => ({
  name: "HKDF" as const,
  hash: "SHA-256" as const,
  salt,
  info,
});

const deriveAesKey = (
  keyMaterial: CryptoKey,
  salt: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> =>
  crypto.subtle.deriveKey(
    hkdfParams(salt, info),
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

const sealWithKey = async (
  aesKey: CryptoKey,
  plaintext: string,
  kid: string
): Promise<CipherEnvelope> => {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    textEncoder.encode(plaintext)
  );

  return {
    v: 1,
    kid,
    iv: bytesToBase64Url(iv),
    ct: bytesToBase64Url(new Uint8Array(encrypted)),
  };
};

const openEnvelope = async (
  envelope: CipherEnvelope,
  aesKey: CryptoKey
): Promise<string> => {
  const iv = base64UrlToBytes(envelope.iv);
  const ciphertext = base64UrlToBytes(envelope.ct);
  if (iv.length !== GCM_IV_BYTES || ciphertext.length === 0) {
    throw new Error("Invalid ciphertext envelope");
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
};

const envelopeToWire = (envelope: CipherEnvelope): string =>
  JSON.stringify(envelope);

const wireToEnvelope = (wire: string): CipherEnvelope => {
  const parsed = JSON.parse(wire) as CipherEnvelope;
  if (parsed?.v !== 1 || !parsed.kid || !parsed.iv || !parsed.ct) {
    throw new Error("Invalid ciphertext wire format");
  }
  return parsed;
};

const masterKey = async (appMasterKey: string): Promise<CryptoKey> => {
  const material = await getHkdfKeyMaterial(appMasterKey);
  return deriveAesKey(material, new Uint8Array(0), CHAT_INFO);
};

export const hmacTelegramUserId = async (
  pepper: string,
  telegramUserId: number
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(`${HMAC_INFO.length}:${telegramUserId}`)
  );

  return bytesToBase64Url(new Uint8Array(signature));
};

export const encryptTelegramChatId = async (
  chatId: number,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await masterKey(appMasterKey);
  return envelopeToWire(
    await sealWithKey(aesKey, chatId.toString(), MASTER_KID)
  );
};

export const decryptTelegramChatId = async (
  ciphertext: string,
  appMasterKey: string
): Promise<number> => {
  const aesKey = await masterKey(appMasterKey);
  const plaintext = await openEnvelope(wireToEnvelope(ciphertext), aesKey);
  const chatId = Number(plaintext);
  if (!Number.isSafeInteger(chatId)) {
    throw new Error("Invalid chat id");
  }
  return chatId;
};

export const generateOpaqueId = (bytes = 16): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

const hmacSha256Base64Url = async (
  secret: string,
  message: string
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(message)
  );
  return bytesToBase64Url(new Uint8Array(signature));
};

export const createCapabilityLookupHash = (
  capability: string,
  lookupSecret: string
): Promise<string> => hmacSha256Base64Url(lookupSecret, `${LOOKUP_INFO}${capability}`);

export const createMessageDedupeKey = (
  lookupSecret: string,
  senderHash: string,
  recipientHash: string,
  telegramMessageId: number
): Promise<string> =>
  hmacSha256Base64Url(
    lookupSecret,
    `${DEDUPE_INFO}${senderHash}:${recipientHash}:${telegramMessageId}`
  );

export const createBlockHash = (
  lookupSecret: string,
  ownerHash: string,
  peerHash: string
): Promise<string> =>
  hmacSha256Base64Url(lookupSecret, `${BLOCK_INFO}${ownerHash}:${peerHash}`);

export type CapabilityAction =
  | "open"
  | "reply"
  | "block"
  | "unblock"
  | "report"
  | "nickname";

const CALLBACK_PREFIX: Record<CapabilityAction, string> = {
  open: "o",
  reply: "r",
  block: "b",
  unblock: "u",
  report: "rp",
  nickname: "n",
};

export const encodeCapabilityCallbackData = (
  action: CapabilityAction,
  capability: string
): string => {
  const data = `${CALLBACK_PREFIX[action]}:${capability}`;
  if (new TextEncoder().encode(data).length > 64) {
    throw new Error("Telegram callback_data limit exceeded");
  }
  return data;
};

const scopedPayloadSalt = (scopeId: string): Uint8Array =>
  base64UrlToBytes(scopeId);

const deriveScopedPayloadKey = async (
  scopeId: string,
  appMasterKey: string
): Promise<CryptoKey> =>
  deriveAesKey(
    await getHkdfKeyMaterial(appMasterKey),
    scopedPayloadSalt(scopeId),
    AES_INFO
  );

const encryptScopedPayload = async (
  scopeId: string,
  payload: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await deriveScopedPayloadKey(scopeId, appMasterKey);
  return envelopeToWire(
    await sealWithKey(aesKey, payload, `payload:${scopeId.slice(0, 8)}`)
  );
};

const decryptScopedPayload = async (
  scopeId: string,
  ciphertext: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await deriveScopedPayloadKey(scopeId, appMasterKey);
  return openEnvelope(wireToEnvelope(ciphertext), aesKey);
};

/** Opaque per-recipient sender handle for contact labels. */
export const getSenderAlias = async (
  recipientUserId: string,
  senderUserId: string,
  appMasterKey: string
): Promise<string> => {
  const material = await getHkdfKeyMaterial(appMasterKey);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textEncoder.encode(recipientUserId),
      info: textEncoder.encode(`nekonymous:label:v1:${senderUserId}`),
    },
    material,
    SENDER_ALIAS_BITS
  );
  return bytesToBase64Url(new Uint8Array(bits));
};

export const encryptMatchIntro = async (
  requestId: string,
  intro: string,
  appMasterKey: string
): Promise<string> => encryptScopedPayload(requestId, intro, appMasterKey);

export const decryptMatchIntro = async (
  requestId: string,
  ciphertext: string,
  appMasterKey: string
): Promise<string> => decryptScopedPayload(requestId, ciphertext, appMasterKey);

export const encryptDisplayName = async (
  name: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await masterKey(appMasterKey);
  return envelopeToWire(await sealWithKey(aesKey, name, MASTER_KID));
};

export const decryptDisplayName = async (
  ciphertext: string,
  appMasterKey: string
): Promise<string> => {
  const aesKey = await masterKey(appMasterKey);
  return openEnvelope(wireToEnvelope(ciphertext), aesKey);
};

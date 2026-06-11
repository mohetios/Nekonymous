/**
 * Crypto + conversation parsing smoke tests against production modules.
 * Run: pnpm test:crypto
 */

import { parseConversation } from "../src/utils/payload.ts";
import {
  decryptPayload,
  encryptConversationPayload,
  encryptedPayload,
  generateTicketId,
} from "../src/utils/ticket.ts";

const appSecureKey = "test-app-secure-key-local";
const sample = JSON.stringify({
  connection: { from: 111, to: "222222222" },
  payload: { message_type: "text", message_text: "سلام" },
});

const ticketId = generateTicketId();
const { conversationId, ciphertext: fromBundle } =
  await encryptConversationPayload(ticketId, sample, appSecureKey);
const fromReencrypt = await encryptedPayload(ticketId, sample, appSecureKey);

const decryptedBundle = await decryptPayload(ticketId, fromBundle, appSecureKey);
const decryptedReencrypt = await decryptPayload(
  ticketId,
  fromReencrypt,
  appSecureKey
);

if (decryptedBundle !== sample || decryptedReencrypt !== sample) {
  console.error("Crypto roundtrip failed");
  process.exit(1);
}

const parsed = parseConversation(decryptedBundle);
if (!parsed || parsed.connection.to !== 222222222) {
  console.error("parseConversation string-ID test failed");
  process.exit(1);
}

console.log("Crypto roundtrip OK");
console.log("parseConversation string-ID OK");
console.log(`ticketId length: ${ticketId.length}`);
console.log(`conversationId length: ${conversationId.length}`);

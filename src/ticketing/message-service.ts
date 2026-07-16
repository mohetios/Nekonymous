import type { Environment } from "../types/runtime.env";
import type { MessagePayload } from "../types/telegram.delivery";
import { decryptEnvelope } from "./envelope";
import { payloadAad } from "./keys";
import { createSealedTicket, payloadCapsuleToMessagePayload } from "./create-sealed-ticket";
import type {
  RouteCapsule,
  SendMessageInput,
  CreateSealedTicketResult,
  TicketPayloadCapsule as PayloadCapsule,
} from "../types/ticketing.model";
import type { ResolvedTicketAction } from "../types/ticketing.actions";
import {
  markTicketViewed,
} from "../storage/ticket-vault.client";

export const hasDeliverablePayload = (payload: MessagePayload): boolean => {
  if (!payload.message_type) {
    return false;
  }
  if (payload.message_type === "text") {
    return !!payload.message_text?.trim();
  }
  return true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMessagePayload = (value: unknown): value is MessagePayload => {
  if (!isRecord(value)) {
    return false;
  }
  if (!Number.isSafeInteger(value.telegramMessageId)) {
    return false;
  }
  if (!Number.isSafeInteger(value.createdAt)) {
    return false;
  }
  if (
    value.message_type !== undefined &&
    typeof value.message_type !== "string"
  ) {
    return false;
  }
  if (
    value.message_text !== undefined &&
    typeof value.message_text !== "string"
  ) {
    return false;
  }
  return true;
};

const isPayloadCapsule = (value: unknown): value is PayloadCapsule => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.type === "text") {
    return (
      typeof value.text === "string" &&
      Number.isSafeInteger(value.telegramMessageId) &&
      Number.isSafeInteger(value.createdAt)
    );
  }
  if (value.type === "telegram") {
    return isMessagePayload(value.payload);
  }
  return false;
};

export const sendAnonymousMessage = async (
  env: Environment,
  input: SendMessageInput
): Promise<CreateSealedTicketResult> => createSealedTicket(env, input);

export const deliveryContextFromResolvedTicket = async (
  resolved: ResolvedTicketAction,
  senderLabel?: string
): Promise<{
  payload: MessagePayload;
  route: RouteCapsule;
  senderLabel?: string;
}> => {
  if (!resolved.ticket.payloadEnc) {
    throw new Error("Missing payload");
  }

  const capsule = await decryptEnvelope<unknown>(
    resolved.payloadKey,
    resolved.ticket.payloadEnc,
    payloadAad(resolved.ticketHash)
  );
  if (!isPayloadCapsule(capsule)) {
    throw new Error("Invalid payload capsule");
  }
  const payload = payloadCapsuleToMessagePayload(capsule);

  return {
    payload,
    route: resolved.route,
    ...(senderLabel ? { senderLabel } : {}),
  };
};

export const markResolvedTicketViewed = async (
  env: Environment,
  resolved: ResolvedTicketAction
): Promise<void> => {
  await markTicketViewed(env, resolved.ticketHash);
};

import type { Environment } from "../types/runtime.env";
import { decryptEnvelope } from "./envelope";
import {
  createOwnerProofTag,
  createTicketHash,
  deriveTicketKeys,
  routeAad,
} from "./keys";
import { constantTimeEqual } from "./hmac";
import {
  getTicketRecord,
  TicketExpiredError,
} from "../storage/ticket-vault.client";
import type { RouteCapsule } from "../types/ticketing.model";
import { parseTicketCapability } from "./ticket-capability";
import type {
  ExpiredTicketAction,
  ResolveTicketActionResult,
  TicketActionKind,
} from "../types/ticketing.actions";

export const isExpiredTicketAction = (
  value: ResolveTicketActionResult | null
): value is ExpiredTicketAction =>
  value !== null && "expired" in value && value.expired === true;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRouteCapsule = (value: unknown): value is RouteCapsule => {
  if (!isRecord(value)) {
    return false;
  }
  const replyPolicy = value.replyPolicy;
  return (
    typeof value.senderChatRoute === "string" &&
    typeof value.replyRouteTag === "string" &&
    typeof value.contactTag === "string" &&
    typeof value.blockTag === "string" &&
    typeof value.abuseSubjectTag === "string" &&
    isRecord(replyPolicy) &&
    typeof replyPolicy.canReply === "boolean" &&
    typeof replyPolicy.maxChars === "number"
  );
};

export const resolveTicketAction = async (
  env: Environment,
  action: TicketActionKind,
  ticketRef: string,
  actor: { actorHash: string; actorUserId: string }
): Promise<ResolveTicketActionResult | null> => {
  let capability;
  try {
    capability = parseTicketCapability(ticketRef);
  } catch {
    return null;
  }

  const { actorHash, actorUserId } = actor;
  const ticketHash = await createTicketHash(env.APP_HMAC_PEPPER, capability);

  const ownerProofCandidate = await createOwnerProofTag(
    env.APP_HMAC_PEPPER,
    actorHash,
    actorUserId,
    ticketHash
  );

  let ticket;
  try {
    ticket = await getTicketRecord(env, ticketHash);
  } catch (error) {
    if (error instanceof TicketExpiredError) {
      return { expired: true };
    }
    throw error;
  }
  if (!ticket) {
    return null;
  }

  if (!constantTimeEqual(ownerProofCandidate, ticket.ownerProofTag)) {
    return null;
  }

  if (!ticket.routeEnc) {
    return { expired: true };
  }

  const keys = await deriveTicketKeys(env.APP_MASTER_KEY, ticketHash, capability);
  const route = await decryptEnvelope<unknown>(
    keys.routeKey,
    ticket.routeEnc,
    routeAad(ticketHash)
  );

  if (!isRouteCapsule(route)) {
    return null;
  }

  return {
    action,
    ticketRef,
    ticketHash,
    actorHash,
    actorUserId,
    ticket,
    routeKey: keys.routeKey,
    payloadKey: keys.payloadKey,
    metaKey: keys.metaKey,
    route,
  };
};

import type { D1User } from "../types/identity.model";
import type { Environment } from "../types/runtime.env";
import { REQUEST_CALLBACK } from "./suggestion-constants.ts";
import {
  SUGGESTION_ACCEPTED_REQUESTER,
  SUGGESTION_DECLINED_REQUESTER,
  SUGGESTION_INCOMING_ACCEPT_NOTE,
  SUGGESTION_INCOMING_INTRO_LABEL,
  SUGGESTION_INCOMING_WHY_FIT,
} from "../i18n/conversation-suggestions-ui.ts";
import { escapeHtml } from "../utils/text.ts";
import { getUserById } from "../identity/identity-service.ts";
import { enqueueTelegramOutbox } from "../storage/telegram-outbox.client.ts";

const truncateIntro = (intro: string, max = 240): string =>
  intro.length <= max ? intro : `${intro.slice(0, max - 1)}…`;

export const notifyIncomingConversationRequest = async (
  env: Environment,
  candidateUserId: string,
  requestRef: string,
  requestHash: string,
  introText: string,
  explanation: string
): Promise<void> => {
  const candidate = await getUserById(candidateUserId, env);
  if (!candidate) {
    return;
  }

  const text =
    `${SUGGESTION_INCOMING_ACCEPT_NOTE}\n\n` +
    `${SUGGESTION_INCOMING_WHY_FIT}\n${escapeHtml(explanation)}\n\n` +
    `${SUGGESTION_INCOMING_INTRO_LABEL}\n${escapeHtml(truncateIntro(introText))}`;

  await enqueueTelegramOutbox(env, {
    idempotencyKey: `request-notify:${requestHash}`,
    chatCiphertext: candidate.telegram_chat_ciphertext,
    chatHash: candidate.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ پذیرفتن",
              callback_data: REQUEST_CALLBACK.accept(requestRef),
            },
            {
              text: "❌ رد کردن",
              callback_data: REQUEST_CALLBACK.decline(requestRef),
            },
          ],
        ],
      },
    },
    priority: "normal",
    createdAt: Date.now(),
  });
};

export const notifyRequesterAccepted = async (
  env: Environment,
  requester: D1User,
  requestHash: string
): Promise<void> => {
  await enqueueTelegramOutbox(env, {
    idempotencyKey: `request-accepted:${requestHash}`,
    chatCiphertext: requester.telegram_chat_ciphertext,
    chatHash: requester.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text: SUGGESTION_ACCEPTED_REQUESTER,
      parse_mode: "HTML",
    },
    priority: "low",
    createdAt: Date.now(),
  });
};

export const notifyRequesterDeclined = async (
  env: Environment,
  requester: D1User,
  requestHash: string
): Promise<void> => {
  await enqueueTelegramOutbox(env, {
    idempotencyKey: `request-declined:${requestHash}`,
    chatCiphertext: requester.telegram_chat_ciphertext,
    chatHash: requester.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text: SUGGESTION_DECLINED_REQUESTER,
      parse_mode: "HTML",
    },
    priority: "low",
    createdAt: Date.now(),
  });
};

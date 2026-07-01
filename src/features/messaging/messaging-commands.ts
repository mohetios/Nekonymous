import type { Context } from "grammy";
import type { Environment } from "../../types";
import {
  handlePendingSettingsInput,
  handleSettingsMenu,
} from "../settings/settings-handlers";
import { handleMatchIntroInput } from "../matching/match-handlers";
import { handleMatchSystemMenu } from "../matching/match-system-handlers";
import {
  buildDraftMenu,
  createMessageKeyboard,
  mainMenu,
} from "../../bot/keyboards";
import { handleMenuCommand } from "../../bot/menu";
import { logBotError } from "../../utils/logs";
import {
  EMPTY_INBOX_MESSAGE,
  HuhMessage,
  INBOX_FULL_MESSAGE,
  MESSAGE_SENT_MESSAGE,
  REPLY_SENT_MESSAGE,
  NICKNAME_LIMIT_MESSAGE,
  NICKNAME_REMOVED_MESSAGE,
  NICKNAME_SAVED_MESSAGE,
  NICKNAME_TEXT_ONLY_MESSAGE,
  NoUserFoundMessage,
  OWNER_PAUSED_NOTE,
  RECIPIENT_PAUSED_MESSAGE,
  SELF_MESSAGE_DISABLE_MESSAGE,
  StartConversationMessage,
  UnsupportedMessageTypeMessage,
  USER_IS_BLOCKED_MESSAGE,
  WelcomeMessage,
} from "../../i18n/messages";
import { PEER_USER_FALLBACK } from "../../i18n/defaults";
import {
  ContactLabelLimitError,
  sanitizeNickname,
  setContactLabel,
} from "../../utils/contact";
import { messageToPayload } from "./payload-service";
import { createBlockHash } from "../../ticketing/ticketing-service";
import {
  deliveryContextFromResolvedTicket,
  hasDeliverablePayload,
  markResolvedTicketViewed,
  notifyMessageSeen,
  notifyRecipientInbox,
  sendAnonymousMessage,
  toTicketDeliveryConversation,
} from "./messaging-service";
import {
  getActiveSlugForUser,
  getUserByPublicSlug,
  getUserByTelegramHash,
  resolveOrCreateUser,
  toBotUser,
  getUserById,
} from "../identity/identity-service";
import {
  checkCanReceive,
  clearDraft,
  getDraft,
  listInboxPage,
  markInboxPointerViewed,
  markInboxPointerReplied,
  setDraft,
} from "../../storage/user-state-client";
import {
  expireTicketRecord,
  markTicketReplied,
} from "../../storage/ticket-vault/ticket-vault.client";
import { escapeHtml, replyHtml, withHtml } from "../../utils/tools";
import { buildUserDeepLink, isUserLinkId, publicDisplayName } from "../../utils/user";
import { openInboxTicketRef } from "./inbox-pointer";
import {
  isExpiredTicketAction,
  resolveTicketAction,
} from "./resolve-ticket-action";
import { sendDecryptedMessage } from "../../utils/sender";

const INBOX_DRAIN_MAX_BATCHES = 5;

export const handleStartCommand = async (
  ctx: Context,
  env: Environment,
  botUsername: string
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    if (!ctx.match) {
      const welcome = WelcomeMessage.replace(
        "UUID_USER_URL",
        buildUserDeepLink(botUsername, user.slug)
      );
      await ctx.reply(
        user.paused ? `${OWNER_PAUSED_NOTE}\n\n${welcome}` : welcome,
        withHtml({ reply_markup: mainMenu })
      );
      return;
    }

    if (typeof ctx.match !== "string") {
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      return;
    }

    const linkId = ctx.match.trim();
    if (!isUserLinkId(linkId)) {
      await ctx.reply(NoUserFoundMessage);
      return;
    }

    const recipientD1 = await getUserByPublicSlug(linkId, env);
    if (!recipientD1 || recipientD1.id === user.id) {
      await ctx.reply(
        recipientD1 ? SELF_MESSAGE_DISABLE_MESSAGE : NoUserFoundMessage
      );
      return;
    }

    const recipient = await toBotUser(recipientD1, env);

    const startBlockHash = await createBlockHash(
      env.APP_HMAC_PEPPER,
      recipientD1.telegram_user_hash,
      d1User.telegram_user_hash
    );

    if (recipient.blockedUserIds.includes(startBlockHash)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      return;
    }

    if (recipient.paused) {
      await ctx.reply(
        RECIPIENT_PAUSED_MESSAGE.replace(
          "USER_NAME",
          escapeHtml(publicDisplayName(recipient, PEER_USER_FALLBACK))
        ),
        withHtml()
      );
      return;
    }

    const prompt = await ctx.reply(
      StartConversationMessage.replace(
        "USER_NAME",
        escapeHtml(publicDisplayName(recipient))
      ),
      withHtml({ reply_markup: buildDraftMenu() })
    );

    await setDraft(env, user.id, {
      id: "primary",
      mode: "compose",
      toUserId: recipient.id,
      linkSlug: linkId,
      parent_message_id: prompt.message_id,
    });
  } catch (error) {
    logBotError("handleStartCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleMessage = async (
  ctx: Context,
  env: Environment,
  botUsername: string
): Promise<void> => {
  const from = ctx.from;
  const message = ctx.message;
  if (!from || !message) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    if (await handleMenuCommand(ctx, user, botUsername)) {
      return;
    }

    if (await handleMatchSystemMenu(ctx, env)) {
      return;
    }

    if (await handleSettingsMenu(ctx, user, env)) {
      return;
    }

    if (await handlePendingSettingsInput(ctx, user, env)) {
      return;
    }

    const draft = (await getDraft(env, user.id)) ?? user.draft;

    if (draft?.mode === "match_intro" && draft.replyRef) {
      await handleMatchIntroInput(ctx, user.id, draft.replyRef, env);
      return;
    }

    const pendingNickname = draft?.pendingNicknameAlias;
    if (pendingNickname) {
      if (!message.text) {
        await ctx.reply(
          NICKNAME_TEXT_ONLY_MESSAGE,
          withHtml({ reply_markup: buildDraftMenu() })
        );
        return;
      }

      try {
        const nickname = sanitizeNickname(message.text);
        await setContactLabel(
          env,
          user.id,
          pendingNickname,
          "",
          nickname,
          user.contactLabels
        );
        await clearDraft(env, user.id);
        await ctx.reply(
          nickname
            ? NICKNAME_SAVED_MESSAGE.replace("NAME", escapeHtml(nickname))
            : NICKNAME_REMOVED_MESSAGE,
          withHtml({ reply_markup: mainMenu })
        );
      } catch (error) {
        if (error instanceof ContactLabelLimitError) {
          await ctx.reply(NICKNAME_LIMIT_MESSAGE, { reply_markup: mainMenu });
        } else {
          logBotError("handleMessage:nickname", error);
          await ctx.reply(HuhMessage, { reply_markup: mainMenu });
        }
      }
      return;
    }

    const recipientId = draft?.toUserId;
    if (!recipientId) {
      if (draft?.mode === "match_intro") {
        await ctx.reply(HuhMessage, { reply_markup: buildDraftMenu() });
        return;
      }
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      return;
    }

    const recipientD1 = await getUserById(recipientId, env);
    const isThreadReply = draft?.reply_to_message_id !== undefined;

    if (!recipientD1) {
      await ctx.reply(NoUserFoundMessage, { reply_markup: mainMenu });
      await clearDraft(env, user.id);
      return;
    }

    const recipient = await toBotUser(recipientD1, env);
    const linkSlug = draft?.linkSlug;
    const activeSlug = await getActiveSlugForUser(recipient.id, env);

    if (!linkSlug || activeSlug !== linkSlug) {
      await ctx.reply(NoUserFoundMessage, { reply_markup: mainMenu });
      await clearDraft(env, user.id);
      return;
    }

    const blockHash = await createBlockHash(
      env.APP_HMAC_PEPPER,
      recipientD1.telegram_user_hash,
      d1User.telegram_user_hash
    );

    if (recipient.blockedUserIds.includes(blockHash)) {
      await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      await clearDraft(env, user.id);
      return;
    }

    const canReceive = await checkCanReceive(env, recipientD1.id, blockHash);
    if (!canReceive.ok && !isThreadReply) {
      if (canReceive.reason === "blocked") {
        await ctx.reply(USER_IS_BLOCKED_MESSAGE);
      } else {
        await ctx.reply(
          RECIPIENT_PAUSED_MESSAGE.replace(
            "USER_NAME",
            escapeHtml(publicDisplayName(recipient, PEER_USER_FALLBACK))
          ),
          withHtml()
        );
      }
      await clearDraft(env, user.id);
      return;
    }

    const payload = messageToPayload(message);
    if (!hasDeliverablePayload(payload)) {
      await ctx.reply(UnsupportedMessageTypeMessage, {
        reply_markup: buildDraftMenu(),
        reply_to_message_id: draft?.parent_message_id,
      });
      return;
    }

    const result = await sendAnonymousMessage(env, {
      sender: d1User,
      recipient: recipientD1,
      payload,
      linkSlug,
      isThreadReply,
      replyToMessageId: draft?.reply_to_message_id,
    });

    if (!result.ok) {
      await ctx.reply(
        result.status === 429 ? INBOX_FULL_MESSAGE : HuhMessage,
        { reply_to_message_id: draft?.parent_message_id }
      );
      return;
    }

    const sentMessage =
      draft?.mode === "reply" ? REPLY_SENT_MESSAGE : MESSAGE_SENT_MESSAGE;
    await replyHtml(ctx, sentMessage, {
      reply_to_message_id: draft?.parent_message_id,
    });

    if (result.notify) {
      try {
        await notifyRecipientInbox(
          env,
          recipientD1,
          result.pendingCount ?? 1
        );
      } catch (error) {
        logBotError("handleMessage:notify", error);
      }
    }

    if (draft?.mode === "reply" && draft.replyRef) {
      await Promise.all([
        markInboxPointerReplied(env, user.id, draft.replyRef),
        markTicketReplied(env, draft.replyRef),
      ]).catch((error) => logBotError("handleMessage:mark-replied", error));
    }

    await clearDraft(env, user.id);
  } catch (error) {
    logBotError("handleMessage", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

const expireTicketsBestEffort = async (
  env: Environment,
  ticketHashes: string[]
): Promise<void> => {
  await Promise.all(
    ticketHashes.map((ticketHash) =>
      expireTicketRecord(env, ticketHash).catch((error) =>
        logBotError("handleInboxCommand:expire", error)
      )
    )
  );
};

const renderInbox = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const user = await toBotUser(d1User, env);

    let shown = 0;
    let failed = 0;

    for (let batch = 0; batch < INBOX_DRAIN_MAX_BATCHES; batch += 1) {
      const page = await listInboxPage(env, user.id, 0);
      await expireTicketsBestEffort(env, page.expiredTicketHashes);

      if (page.pointers.length === 0) {
        break;
      }

      let progressed = false;

      for (const pointer of page.pointers) {
        const ticketRef = await openInboxTicketRef(env, pointer);
        if (!ticketRef) {
          await markInboxPointerViewed(env, user.id, pointer.ticketHash).catch(
            (error) => logBotError("handleInboxCommand:drop-pointer", error)
          );
          failed += 1;
          progressed = true;
          continue;
        }

        try {
          const resolved = await resolveTicketAction(
            ctx,
            env,
            "open",
            ticketRef,
            d1User.telegram_user_hash
          );

          if (!resolved) {
            await markInboxPointerViewed(env, user.id, pointer.ticketHash).catch(
              (error) => logBotError("handleInboxCommand:drop-pointer", error)
            );
            failed += 1;
            progressed = true;
            continue;
          }

          if (isExpiredTicketAction(resolved)) {
            await Promise.all([
              expireTicketRecord(env, pointer.ticketHash),
              markInboxPointerViewed(env, user.id, pointer.ticketHash),
            ]).catch((error) =>
              logBotError("handleInboxCommand:expire-pointer", error)
            );
            progressed = true;
            continue;
          }

          const senderD1 = await getUserByTelegramHash(
            resolved.route.senderRouteTag,
            env
          );
          const isBlocked = senderD1
            ? user.blockedUserIds.includes(
                await createBlockHash(
                  env.APP_HMAC_PEPPER,
                  d1User.telegram_user_hash,
                  senderD1.telegram_user_hash
                )
              )
            : false;
          const keyboard = createMessageKeyboard(ticketRef, isBlocked);

          if (
            resolved.ticket.status === "active" &&
            resolved.ticket.payloadEnc
          ) {
            const delivery = await deliveryContextFromResolvedTicket(
              resolved,
              user.contactLabels
            );

            if (!hasDeliverablePayload(delivery.payload)) {
              await markResolvedTicketViewed(
                env,
                user.id,
                resolved.ticketHash
              );
              failed += 1;
              progressed = true;
              continue;
            }

            await sendDecryptedMessage(
              ctx,
              toTicketDeliveryConversation(
                resolved.route,
                delivery.payload,
                0,
                0
              ),
              { reply_markup: keyboard },
              delivery.senderLabel
            );
            await markResolvedTicketViewed(env, user.id, resolved.ticketHash);

            if (senderD1) {
              await notifyMessageSeen(
                env,
                senderD1,
                resolved.route.parentMessageId
              ).catch((error) => logBotError("handleInboxCommand:seen", error));
            }

            shown += 1;
            progressed = true;
          } else {
            await markResolvedTicketViewed(env, user.id, resolved.ticketHash);
            progressed = true;
          }
        } catch (error) {
          failed += 1;
          logBotError("handleInboxCommand:render", error);
        }
      }

      if (page.nextOffset === undefined || !progressed) {
        break;
      }
    }

    if (shown === 0) {
      if (failed > 0) {
        await ctx.reply(HuhMessage, { reply_markup: mainMenu });
      } else {
        await ctx.reply(EMPTY_INBOX_MESSAGE, withHtml({ reply_markup: mainMenu }));
      }
    }
  } catch (error) {
    logBotError("handleInboxCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleInboxCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  await renderInbox(ctx, env);
};

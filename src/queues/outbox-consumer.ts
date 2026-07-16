import type { Environment } from "../types/runtime.env";
import type {
  InboxDrainJob,
  InboxNotificationJob,
} from "../types/inbox.events";
import {
  isInboxDrainJob,
  isInboxNotificationJob,
} from "../types/inbox.events";
import type { OutboxQueueJob } from "../types/queue.events";
import type {
  OrderedOutboxLaneWork,
  OutboxLaneWork,
} from "../types/queue.outbox-lanes";
import type { TelegramOutboxJob } from "../types/telegram.outbox";
import type { D1User } from "../types/identity.model";
import { sendViaOutboxDo } from "../storage/telegram-outbox.client";
import { drainUnreadInbox } from "../ticketing/inbox";
import { INBOX_MENU_CALLBACK } from "../bot/callback-data";
import { DELIVER_INBOX_BUTTON } from "../i18n/labels";
import { inboxFreshNoticeMessage } from "../i18n/messages";
import { getUserById } from "../identity/identity-service";
import { getUnreadSummary } from "../storage/user-state.client";
import { logBotError } from "../utils/logs";
import { mapBounded } from "../utils/concurrency";

const OUTBOX_CHAT_CONCURRENCY = 4;
const OUTBOX_ACCOUNT_CONCURRENCY = 4;
type AccountUsers = ReadonlyMap<string, D1User | null>;

const noticeReplyMarkup = {
  inline_keyboard: [
    [
      {
        text: DELIVER_INBOX_BUTTON,
        callback_data: INBOX_MENU_CALLBACK.deliver,
      },
    ],
  ],
};

const retryMessage = (
  message: Message<TelegramOutboxJob>,
  delaySeconds?: number
): void => {
  if (typeof delaySeconds === "number" && delaySeconds > 0) {
    message.retry({ delaySeconds });
    return;
  }
  message.retry();
};

const handleChatMessages = async (
  messages: Message<TelegramOutboxJob>[],
  env: Environment
): Promise<void> => {
  let retryRestDelay: number | undefined;

  for (const message of messages) {
    if (retryRestDelay !== undefined) {
      retryMessage(message, retryRestDelay);
      continue;
    }

    try {
      const result = await sendViaOutboxDo(env, message.body);
      switch (result.status) {
        case "sent":
          message.ack();
          break;
        case "retry":
          retryRestDelay = result.delaySeconds;
          logBotError("queue:telegram", new Error("Telegram outbox retry"), {
            retryable: true,
            delaySeconds: retryRestDelay,
          });
          retryMessage(message, retryRestDelay);
          break;
        case "rejected":
          logBotError("queue:telegram", new Error("Telegram outbox rejected"), {
            permanent: true,
          });
          message.ack();
          break;
      }
    } catch (error) {
      retryRestDelay = 5;
      logBotError("queue:telegram", error, {
        retryable: true,
        delaySeconds: retryRestDelay,
      });
      retryMessage(message, retryRestDelay);
    }
  }
};

const notificationJobForUser = (
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>,
  eventId: string,
  unreadCount: number
): TelegramOutboxJob => ({
  idempotencyKey: `inbox-notification:${user.id}:${eventId}`,
  kind: "telegram",
  chatCiphertext: user.telegram_chat_ciphertext,
  chatHash: user.telegram_user_hash,
  method: "sendMessage",
  payload: {
    text: inboxFreshNoticeMessage(unreadCount),
    parse_mode: "HTML",
    reply_markup: noticeReplyMarkup,
  },
  priority: "low",
  createdAt: Date.now(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const handleInboxNotificationMessage = async (
  message: Message<InboxNotificationJob>,
  env: Environment,
  accountUsers: AccountUsers
): Promise<void> => {
  if (!isInboxNotificationJob(message.body)) {
    logBotError(
      "queue:inbox-notification",
      new Error("Invalid inbox notification job"),
      { permanent: true }
    );
    message.ack();
    return;
  }

  try {
    const { accountId, eventId } = message.body;
    const user = accountUsers.get(accountId);
    if (!user) {
      message.ack();
      return;
    }

    const summary = await getUnreadSummary(env, accountId);
    if (summary.unreadCount <= 0) {
      message.ack();
      return;
    }

    const result = await sendViaOutboxDo(
      env,
      notificationJobForUser(user, eventId, summary.unreadCount)
    );
    if (result.status === "sent") {
      message.ack();
      return;
    }

    if (result.status === "rejected") {
      logBotError(
        "queue:inbox-notification",
        new Error("Inbox notification permanently rejected"),
        { permanent: true }
      );
      message.ack();
      return;
    }

    logBotError("queue:inbox-notification", new Error("Inbox notification retry"), {
      retryable: true,
      delaySeconds: result.delaySeconds,
    });
    message.retry({ delaySeconds: result.delaySeconds });
  } catch (error) {
    logBotError("queue:inbox-notification", error, {
      retryable: true,
      delaySeconds: 5,
    });
    message.retry({ delaySeconds: 5 });
  }
};

const handleInboxDrainMessage = async (
  message: Message<InboxDrainJob>,
  env: Environment,
  accountUsers: AccountUsers
): Promise<void> => {
  if (!isInboxDrainJob(message.body)) {
    logBotError("queue:inbox-drain", new Error("Invalid inbox drain job"), {
      permanent: true,
    });
    message.ack();
    return;
  }

  try {
    const result = await drainUnreadInbox(
      env,
      message.body.userId,
      accountUsers.get(message.body.userId) ?? null
    );
    if (result.status === "retry") {
      logBotError("queue:inbox-drain", new Error("Inbox drain retry"), {
        retryable: true,
        delaySeconds: result.delaySeconds,
      });
      message.retry({ delaySeconds: result.delaySeconds });
      return;
    }
    message.ack();
  } catch (error) {
    logBotError("queue:inbox-drain", error, {
      retryable: true,
      delaySeconds: 5,
    });
    message.retry({ delaySeconds: 5 });
  }
};

const resolveAccountChatHash = (
  accountId: string,
  accountUsers: AccountUsers
): string =>
  accountUsers.get(accountId)?.telegram_user_hash ?? `missing:${accountId}`;

const processChatLane = async (
  orderedWork: OrderedOutboxLaneWork[],
  env: Environment,
  accountUsers: AccountUsers
): Promise<void> => {
  const sorted = [...orderedWork].sort((left, right) => left.order - right.order);
  const telegramMessages: Message<TelegramOutboxJob>[] = [];

  for (const entry of sorted) {
    if (entry.work.type === "telegram") {
      telegramMessages.push(...entry.work.messages);
      continue;
    }
    if (telegramMessages.length > 0) {
      await handleChatMessages(telegramMessages, env);
      telegramMessages.length = 0;
    }
    if (entry.work.type === "drain") {
      await handleInboxDrainMessage(entry.work.message, env, accountUsers);
      continue;
    }
    await handleInboxNotificationMessage(
      entry.work.message,
      env,
      accountUsers
    );
  }

  if (telegramMessages.length > 0) {
    await handleChatMessages(telegramMessages, env);
  }
};

export const handleOutboxBatch = async (
  batch: MessageBatch<OutboxQueueJob>,
  env: Environment
): Promise<void> => {
  const accountIds = new Set<string>();
  for (const message of batch.messages) {
    if (isInboxDrainJob(message.body)) {
      accountIds.add(message.body.userId);
    } else if (isInboxNotificationJob(message.body)) {
      accountIds.add(message.body.accountId);
    }
  }
  const accountEntries = await mapBounded(
    [...accountIds],
    OUTBOX_ACCOUNT_CONCURRENCY,
    async (accountId) =>
      [accountId, await getUserById(accountId, env)] as const
  );
  const accountUsers: AccountUsers = new Map(accountEntries);

  const lanes = new Map<string, OrderedOutboxLaneWork[]>();
  let order = 0;

  const appendLaneWork = (chatHash: string, work: OutboxLaneWork): void => {
    const items = lanes.get(chatHash) ?? [];
    items.push({ order: order++, work });
    lanes.set(chatHash, items);
  };

  const appendTelegramMessage = (
    chatHash: string,
    message: Message<TelegramOutboxJob>
  ): void => {
    const items = lanes.get(chatHash) ?? [];
    const last = items[items.length - 1];
    if (last?.work.type === "telegram") {
      last.work.messages.push(message);
      return;
    }
    items.push({
      order: order++,
      work: { type: "telegram", messages: [message] },
    });
    lanes.set(chatHash, items);
  };

  for (const message of batch.messages) {
    const body = message.body;
    if (!isRecord(body) || typeof body.kind !== "string") {
      logBotError(
        "queue:outbox-batch",
        new Error("Invalid outbox queue message body"),
        { permanent: true }
      );
      message.ack();
      continue;
    }

    if (body.kind === "inbox-drain") {
      const drainMessage = message as Message<InboxDrainJob>;
      if (!isInboxDrainJob(drainMessage.body)) {
        logBotError(
          "queue:inbox-drain",
          new Error("Invalid inbox drain job"),
          { permanent: true }
        );
        message.ack();
        continue;
      }
      const chatHash = resolveAccountChatHash(
        drainMessage.body.userId,
        accountUsers
      );
      appendLaneWork(chatHash, { type: "drain", message: drainMessage });
      continue;
    }
    if (body.kind === "inbox-notification") {
      const notificationMessage = message as Message<InboxNotificationJob>;
      if (!isInboxNotificationJob(notificationMessage.body)) {
        logBotError(
          "queue:inbox-notification",
          new Error("Invalid inbox notification job"),
          { permanent: true }
        );
        message.ack();
        continue;
      }
      const chatHash = resolveAccountChatHash(
        notificationMessage.body.accountId,
        accountUsers
      );
      appendLaneWork(chatHash, {
        type: "notification",
        message: notificationMessage,
      });
      continue;
    }
    if (body.kind !== "telegram") {
      logBotError(
        "queue:outbox-batch",
        new Error("Unknown outbox queue message kind"),
        { permanent: true }
      );
      message.ack();
      continue;
    }
    const telegramMessage = message as Message<TelegramOutboxJob>;
    appendTelegramMessage(telegramMessage.body.chatHash, telegramMessage);
  }

  await mapBounded([...lanes.values()], OUTBOX_CHAT_CONCURRENCY, (orderedWork) =>
    processChatLane(orderedWork, env, accountUsers)
  );
};

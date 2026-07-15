import type { Environment } from "../types/runtime.env";
import type {
  InboxNotificationEventId,
  InternalAccountId,
} from "../types/primitives";

export const enqueueInboxNotification = async (
  env: Environment,
  accountId: InternalAccountId,
  eventId: InboxNotificationEventId
): Promise<void> => {
  await env.NEKO_OUTBOX_QUEUE.send(
    {
      kind: "inbox-notification",
      accountId,
      eventId,
    },
    { contentType: "json" }
  );
};

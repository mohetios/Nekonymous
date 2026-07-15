import type {
  DeliveryAttemptId,
  InboxDedupeTag,
  UnixMillis,
  UnreadItemId,
} from "./primitives";
import type { InboxNotificationDecision } from "./inbox.model";
import type { SealedUnreadCapability } from "./crypto.envelope";

export type AddUnreadItemInput = Readonly<{
  itemId: UnreadItemId;
  sealedCapabilityEnc: SealedUnreadCapability;
  dedupeTag: InboxDedupeTag;
  createdAt: UnixMillis;
  expiresAt: UnixMillis;
}>;

export type AddUnreadItemResult = Readonly<{
  ok: boolean;
  status: number;
  unreadCount?: number;
  duplicate?: boolean;
  notification: InboxNotificationDecision;
}>;

export type CompleteUnreadDeliveryInput = Readonly<{
  itemId: UnreadItemId;
  deliveryAttemptId: DeliveryAttemptId;
}>;

export type ReleaseUnreadDeliveryInput = CompleteUnreadDeliveryInput;

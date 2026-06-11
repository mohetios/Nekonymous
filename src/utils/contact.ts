import type { User } from "../types";
import type { KVModel } from "./kv-storage";
import { getSenderAlias } from "./ticket";
import { escapeMarkdownV2 } from "./tools";

const CONTACT_LABELS_MAX = 200;
const NICKNAME_MAX_CHARS = 32;

export const buildDeliveryHeaderLine = (nickname: string): string =>
  `💬 از ${nickname}:`;

export const buildDeliveryHeader = (nickname: string): string =>
  `${buildDeliveryHeaderLine(nickname)}\n\n`;

export const buildDeliveryHeaderMarkdown = (nickname: string): string =>
  `${escapeMarkdownV2(buildDeliveryHeaderLine(nickname))}\n\n`;

export const sanitizeNickname = (input: string): string => {
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "−" || cleaned === "حذف") {
    return "";
  }

  return [...cleaned].slice(0, NICKNAME_MAX_CHARS).join("");
};

export const lookupContactLabel = (
  labels: Record<string, string> | undefined,
  alias: string
): string | undefined => labels?.[alias];

const getSenderAliasCached = async (
  recipientId: number,
  senderId: number,
  appSecureKey: string,
  cache: Map<number, string>
): Promise<string> => {
  const cached = cache.get(senderId);
  if (cached) {
    return cached;
  }

  const alias = await getSenderAlias(recipientId, senderId, appSecureKey);
  cache.set(senderId, alias);
  return alias;
};

export const getContactLabelForSender = async (
  recipientId: number,
  senderId: number,
  labels: Record<string, string> | undefined,
  appSecureKey: string,
  cache?: Map<number, string>
): Promise<string | undefined> => {
  const alias = cache
    ? await getSenderAliasCached(recipientId, senderId, appSecureKey, cache)
    : await getSenderAlias(recipientId, senderId, appSecureKey);
  return lookupContactLabel(labels, alias);
};

export class ContactLabelLimitError extends Error {
  constructor() {
    super("Contact label limit reached");
    this.name = "ContactLabelLimitError";
  }
}

export const setContactLabel = async (
  userModel: KVModel<User>,
  recipientId: number,
  senderAlias: string,
  nickname: string
): Promise<void> => {
  const user = await userModel.get(recipientId.toString());
  if (!user) {
    throw new Error(`User ${recipientId} not found`);
  }

  const labels = { ...(user.contactLabels ?? {}) };

  if (!nickname) {
    delete labels[senderAlias];
  } else {
    const isUpdate = senderAlias in labels;
    if (!isUpdate && Object.keys(labels).length >= CONTACT_LABELS_MAX) {
      throw new ContactLabelLimitError();
    }
    labels[senderAlias] = nickname;
  }

  const nextLabels =
    Object.keys(labels).length > 0 ? labels : undefined;
  await userModel.updateField(
    recipientId.toString(),
    "contactLabels",
    nextLabels
  );
};

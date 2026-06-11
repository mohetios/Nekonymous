import type { Message } from "grammy/types";
import type { Conversation } from "../types";

const toTelegramUserId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
};

export const parseConversation = (raw: string): Conversation | null => {
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      return null;
    }

    const record = data as Conversation;
    const from = toTelegramUserId(record.connection?.from);
    const to = toTelegramUserId(record.connection?.to);
    if (from === null || to === null) {
      return null;
    }

    return {
      ...record,
      connection: { ...record.connection, from, to },
    };
  } catch {
    return null;
  }
};

export const applyMessagePayload = (
  conversation: Conversation,
  message: Message
): void => {
  if (message.text) {
    conversation.payload.message_type = "text";
    conversation.payload.message_text = message.text;
    return;
  }

  if (message.photo) {
    conversation.payload.message_type = "photo";
    conversation.payload.photo_id = message.photo[message.photo.length - 1].file_id;
    conversation.payload.caption = message.caption;
    return;
  }

  if (message.video) {
    conversation.payload.message_type = "video";
    conversation.payload.video_id = message.video.file_id;
    conversation.payload.caption = message.caption;
    return;
  }

  if (message.animation) {
    conversation.payload.message_type = "animation";
    conversation.payload.animation_id = message.animation.file_id;
    conversation.payload.caption = message.caption;
    return;
  }

  if (message.document) {
    conversation.payload.message_type = "document";
    conversation.payload.document_id = message.document.file_id;
    conversation.payload.caption = message.caption;
    return;
  }

  if (message.sticker) {
    conversation.payload.message_type = "sticker";
    conversation.payload.sticker_id = message.sticker.file_id;
    return;
  }

  if (message.voice) {
    conversation.payload.message_type = "voice";
    conversation.payload.voice_id = message.voice.file_id;
    return;
  }

  if (message.video_note) {
    conversation.payload.message_type = "video_note";
    conversation.payload.video_note_id = message.video_note.file_id;
    return;
  }

  if (message.audio) {
    conversation.payload.message_type = "audio";
    conversation.payload.audio_id = message.audio.file_id;
    conversation.payload.caption = message.caption;
  }
};

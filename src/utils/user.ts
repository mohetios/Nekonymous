import type { User } from "../types";
import type { KVModel } from "./kv-storage";
import { incrementStat } from "./logs";

const generateUserLinkId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const ensureUser = async (
  userId: number,
  firstName: string | undefined,
  userModel: KVModel<User>,
  userUUIDtoId: KVModel<string>,
  statsModel: KVModel<number>
): Promise<User> => {
  const existing = await userModel.get(userId.toString());
  if (existing) {
    return existing;
  }

  const userUUID = generateUserLinkId();
  await userUUIDtoId.save(userUUID, userId.toString());
  await userModel.save(userId.toString(), {
    userUUID,
    userName: firstName ?? "بدون نام!",
    blockList: [],
    lastMessage: Date.now(),
    currentConversation: {},
  });
  await incrementStat(statsModel, "newUser");

  const created = await userModel.get(userId.toString());
  if (!created) {
    throw new Error(`Failed to create user ${userId}`);
  }

  return created;
};

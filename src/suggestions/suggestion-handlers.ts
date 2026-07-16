import type { Context } from "grammy";
import type { D1User } from "../types/identity.model";
import type { Environment } from "../types/runtime.env";
import {
  answerCallbackSafely,
  deferContextWork,
  getResolvedUser,
} from "../bot/context";
import { mainMenu } from "../bot/keyboards";
import {
  buildDraftCancelKeyboard,
  draftPlaceholder,
} from "../bot/input-navigation";
import {
  SUGGESTION_CANDIDATES_HEADER,
  SUGGESTION_CANDIDATES_WHY_FIT,
  SUGGESTION_DISCOVERABILITY_ENABLED,
  SUGGESTION_INTRO_EMPTY,
  SUGGESTION_INTRO_PROMPT,
  SUGGESTION_INTRO_TOO_LONG,
  SUGGESTION_NO_CANDIDATES,
  SUGGESTION_NO_CANDIDATES_COOLDOWN,
  SUGGESTION_PENDING_EMPTY,
  SUGGESTION_PROFILE_FAILED,
  SUGGESTION_PROFILE_NO_ASSESSMENT,
  SUGGESTION_RECENT_PAIR_COOLDOWN,
  SUGGESTION_REQUEST_LIMIT,
  SUGGESTION_REQUEST_SENT,
  SUGGESTION_SEARCH_FAILED,
  SUGGESTION_SEARCH_INDEX_PENDING,
  SUGGESTION_SEARCH_LIMIT,
  SUGGESTION_INVALID,
} from "../i18n/conversation-suggestions-ui";
import { HuhMessage } from "../i18n/messages";
import { escapeHtml, withHtml } from "../utils/text";
import { logBotError } from "../utils/logs";
import {
  recordSuggestionSearch,
  recordSuggestionShown,
} from "../stats/product-events";
import {
  isProfileSearchReady,
  loadRequesterProfileContext,
  setConversationDiscoverability,
} from "../profile/profile-service";
import { setDraft } from "../storage/user-state.client";
import { SUGGESTION_HUB_CALLBACK } from "./suggestion-constants";
import { buildSuggestionCandidateKeyboard } from "./suggestion-keyboards";
import { renderSuggestionHub } from "./suggestion-hub";
import { searchConversationSuggestions } from "./suggestion-search";
import {
  dismissSuggestionTicket,
  issueSuggestionTickets,
  markSuggestionViewed,
  parseSuggestionCallback,
  recordSuggestionExposure,
  resolveSuggestionRoute,
} from "./suggestion-service";
import { sendProfileDashboard } from "../profile/profile-handlers";
import { createConversationRequest } from "./request-service.ts";

const INTRO_MAX_CHARS = 500;

const profileUnavailableMessage = (
  reason: "no_profile" | "profile_failed"
): string =>
  reason === "profile_failed"
    ? SUGGESTION_PROFILE_FAILED
    : SUGGESTION_PROFILE_NO_ASSESSMENT;

const searchFailureMessage = (
  reason: "search_limited" | "no_candidates" | "search_failed"
): string => {
  if (reason === "search_limited") {
    return SUGGESTION_SEARCH_LIMIT;
  }
  if (reason === "search_failed") {
    return SUGGESTION_SEARCH_FAILED;
  }
  return SUGGESTION_NO_CANDIDATES_COOLDOWN;
};

const runSuggestionSearch = async (
  ctx: Context,
  env: Environment,
  userId: string,
  actorHash: string
): Promise<void> => {
  const profileContext = await loadRequesterProfileContext(env, userId);
  if (!profileContext.ok) {
    await ctx.reply(
      profileUnavailableMessage(profileContext.reason),
      withHtml({ reply_markup: mainMenu })
    );
    return;
  }
  if (!isProfileSearchReady(profileContext)) {
    await ctx.reply(SUGGESTION_SEARCH_INDEX_PENDING, withHtml({ reply_markup: mainMenu }));
    return;
  }

  const search = await searchConversationSuggestions(env, userId, {
    requesterProfileHash: profileContext.profileHash,
    requesterProfile: profileContext.profile,
  });

  if (!search.ok) {
    await ctx.reply(
      searchFailureMessage(search.reason),
      withHtml({ reply_markup: mainMenu })
    );
    return;
  }

  await deferContextWork(ctx, recordSuggestionSearch(env));
  let issued;
  try {
    issued = await issueSuggestionTickets(env, actorHash, search.results);
    await recordSuggestionExposure(
      env,
      userId,
      issued.map((entry) => entry.pairTag)
    );
  } catch (error) {
    logBotError("runSuggestionSearch:issue", error);
    await ctx.reply(SUGGESTION_SEARCH_FAILED, withHtml({ reply_markup: mainMenu }));
    return;
  }

  if (issued.length === 0) {
    await ctx.reply(SUGGESTION_NO_CANDIDATES, withHtml({ reply_markup: mainMenu }));
    return;
  }

  await deferContextWork(ctx, recordSuggestionShown(env));

  await ctx.reply(SUGGESTION_CANDIDATES_HEADER, withHtml({ reply_markup: mainMenu }));
  for (const [index, entry] of issued.entries()) {
    await ctx.reply(
      `<b>${index + 1}.</b> ${SUGGESTION_CANDIDATES_WHY_FIT}\n${escapeHtml(entry.explanation)}`,
      withHtml({
        reply_markup: buildSuggestionCandidateKeyboard(entry.suggestionRef, index),
      })
    );
  }
};

export const handleMatchCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  await renderSuggestionHub(ctx, env);
};

export const handleMatchCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    return;
  }

  if (data === SUGGESTION_HUB_CALLBACK.hub) {
    const from = ctx.from;
    if (from) {
      await answerCallbackSafely(ctx);
      await renderSuggestionHub(ctx, env);
    } else {
      await answerCallbackSafely(ctx);
    }
    return;
  }

  const from = ctx.from;
  if (!from) {
    await answerCallbackSafely(ctx);
    return;
  }

  try {
    const user = await getResolvedUser(ctx, env);
    const actorHash = user.telegram_user_hash;

    if (data === SUGGESTION_HUB_CALLBACK.search) {
      await answerCallbackSafely(ctx);
      try {
        await runSuggestionSearch(ctx, env, user.id, actorHash);
      } catch (error) {
        logBotError("handleMatchCallback:search", error);
        await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
      }
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.pending) {
      await answerCallbackSafely(ctx);
      await ctx.reply(SUGGESTION_PENDING_EMPTY, withHtml({ reply_markup: mainMenu }));
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.enableDiscover) {
      await answerCallbackSafely(ctx);
      const result = await setConversationDiscoverability(env, user.id, true);
      if (!result.ok) {
        const message =
          result.reason === "not_ready"
            ? SUGGESTION_SEARCH_INDEX_PENDING
            : SUGGESTION_PROFILE_NO_ASSESSMENT;
        await ctx.reply(message, withHtml({ reply_markup: mainMenu }));
        return;
      }
      await ctx.reply(
        SUGGESTION_DISCOVERABILITY_ENABLED,
        withHtml({ reply_markup: mainMenu })
      );
      await renderSuggestionHub(ctx, env);
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.disableDiscover) {
      await answerCallbackSafely(ctx);
      await setConversationDiscoverability(env, user.id, false);
      await renderSuggestionHub(ctx, env);
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.assessment) {
      await answerCallbackSafely(ctx);
      await sendProfileDashboard(ctx, user.id, env);
      return;
    }

    await answerCallbackSafely(ctx);
  } catch (error) {
    logBotError("handleMatchCallback", error);
    await answerCallbackSafely(ctx);
    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  }
};

export const handleSuggestionCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from) {
    await answerCallbackSafely(ctx);
    return;
  }

  const parsed = parseSuggestionCallback(data);
  if (!parsed) {
    await answerCallbackSafely(ctx);
    return;
  }

  await answerCallbackSafely(ctx);
  const user = await getResolvedUser(ctx, env);
  const actorHash = user.telegram_user_hash;

  if (parsed.kind === "dismiss") {
    const result = await dismissSuggestionTicket(
      env,
      actorHash,
      parsed.suggestionRef
    );
    if (!result.ok) {
      await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  if (parsed.kind === "open") {
    const result = await markSuggestionViewed(env, actorHash, parsed.suggestionRef);
    if (!result.ok) {
      await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  const viewed = await markSuggestionViewed(env, actorHash, parsed.suggestionRef);
  if (!viewed.ok) {
    await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    return;
  }

  const prompt = await ctx.reply(
    SUGGESTION_INTRO_PROMPT,
    withHtml({
      reply_markup: buildDraftCancelKeyboard(draftPlaceholder("conversation_intro")),
    })
  );

  await setDraft(env, user.id, {
    id: "primary",
    mode: "conversation_intro",
    linkSlug: parsed.suggestionRef,
    parent_message_id: prompt.message_id,
  });
};

export const handleConversationIntroInput = async (
  ctx: Context,
  env: Environment,
  requester: D1User,
  suggestionRef: string,
  introText: string
): Promise<boolean> => {
  const trimmed = introText.trim();
  if (!trimmed) {
    await ctx.reply(
      SUGGESTION_INTRO_EMPTY,
      withHtml({
        reply_markup: buildDraftCancelKeyboard(draftPlaceholder("conversation_intro")),
      })
    );
    return true;
  }
  if (trimmed.length > INTRO_MAX_CHARS) {
    await ctx.reply(
      SUGGESTION_INTRO_TOO_LONG,
      withHtml({
        reply_markup: buildDraftCancelKeyboard(draftPlaceholder("conversation_intro")),
      })
    );
    return true;
  }

  const profileContext = await loadRequesterProfileContext(env, requester.id);
  if (!profileContext.ok) {
    await ctx.reply(
      profileUnavailableMessage(profileContext.reason),
      withHtml({ reply_markup: mainMenu })
    );
    return true;
  }
  if (!isProfileSearchReady(profileContext)) {
    await ctx.reply(SUGGESTION_SEARCH_INDEX_PENDING, withHtml({ reply_markup: mainMenu }));
    return true;
  }

  const suggestion = await resolveSuggestionRoute(
    env,
    requester.telegram_user_hash,
    suggestionRef
  );
  if (!suggestion.ok) {
    await ctx.reply(SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    return true;
  }

  const result = await createConversationRequest(
    env,
    {
      requester,
      requesterActorHash: requester.telegram_user_hash,
      requesterProfileHash: profileContext.profileHash,
      candidateProfileHash: suggestion.candidateProfileHash,
      pairTag: suggestion.pairTag,
      introText: trimmed,
      suggestionRef,
      explanation: suggestion.explanation,
    },
    (work) => deferContextWork(ctx, work)
  );

  if (!result.ok) {
    const message =
      result.reason === "blocked"
        ? SUGGESTION_RECENT_PAIR_COOLDOWN
        : result.reason === "invalid"
          ? SUGGESTION_REQUEST_LIMIT
          : SUGGESTION_INVALID;
    await ctx.reply(message, withHtml({ reply_markup: mainMenu }));
    return true;
  }

  await ctx.reply(SUGGESTION_REQUEST_SENT, withHtml({ reply_markup: mainMenu }));
  return true;
};

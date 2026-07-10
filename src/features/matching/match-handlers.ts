import type { Context } from "grammy";
import type { Environment } from "../../types";
import { emitStat } from "../../stats/emit-stat";
import { STAT_EVENTS } from "../../stats/events";
import { logBotError } from "../../utils/logs";
import { HuhMessage } from "../../i18n/messages";
import { mainMenu } from "../../bot/keyboards";
import {
  buildDraftCancelKeyboard,
  INPUT_PLACEHOLDERS,
} from "../../bot/input-navigation";
import { renderScreen } from "../../bot/render-screen";
import { withHtml, convertToPersianNumbers } from "../../utils/tools";
import { resolveOrCreateUser } from "../identity/identity-service";
import { setDraft, clearDraft } from "../../storage/user-state-client";
import { getLatestAssessmentProfile } from "../assessment/assessment-profile-service";
import { isCurrentAssessmentVersion } from "../assessment/question-bank";
import { MATCH_CALLBACK, MATCH_INTRO_MAX_CHARS } from "./constants";
import {
  MATCH_INTRO_EMPTY,
  MATCH_INTRO_PROMPT,
  MATCH_INTRO_TEXT_ONLY,
  MATCH_INTRO_TOO_LONG,
  MATCH_NO_CANDIDATES,
  MATCH_NO_CANDIDATES_COOLDOWN,
  MATCH_OPT_IN,
  MATCH_PROFILE_VERSION_OUTDATED,
  MATCH_REQUEST_LIMIT,
  MATCH_REQUEST_SENT,
  MATCH_SEARCH_LIMIT,
  MATCH_SUGGESTION_INVALID,
  MATCH_ACCEPTED_CANDIDATE,
  MATCH_DECLINED_CANDIDATE,
  MATCH_REQUEST_ALREADY_HANDLED,
  MATCH_REQUEST_ALREADY_ACCEPTED,
  MATCH_REQUEST_EXPIRED,
  MATCH_CANDIDATE_UNAVAILABLE,
  MATCH_PENDING_EXISTS,
  MATCH_RECENT_PAIR_COOLDOWN,
  MATCH_PENDING_EMPTY,
  MATCH_PENDING_LIST_HEADER,
  MATCH_REQUEST_CANCELLED,
  MATCH_REQUEST_CANCEL_FAILED,
} from "../../i18n/matching";
import {
  buildIncomingMatchRequestKeyboard,
  buildMatchResultsKeyboard,
  buildMatchSearchKeyboard,
  buildOutgoingMatchRequestKeyboard,
  buildSuggestionHubBackKeyboard,
  formatIncomingMatchRequestMessage,
  formatMatchCandidatesMessage,
  formatOutgoingMatchRequestMessage,
} from "./keyboards";
import {
  createMatchSuggestionBatch,
  disableDiscoverability,
  enableDiscoverability,
  expireOldMatchRequests,
  findTopMatches,
  getMatchSuggestion,
} from "./match-service";
import {
  acceptMatchRequest,
  cancelMatchRequest,
  createMatchRequest,
  declineMatchRequest,
  listPendingMatchRequests,
} from "./match-request-service";
import { decryptMatchIntro } from "../../ticketing/ticketing-service";
import { parseMatchExplanation } from "./match-scoring";
import { getMatchQualityLabel } from "./match-quality";
import { renderSuggestionHub } from "./suggestion-hub";
import { sendAssessmentDashboard } from "../assessment/assessment-handlers";
import { sendMatchProfileScreen } from "./match-profile-screen";

const isBenignEditError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("description" in error)) {
    return false;
  }
  const description = String(error.description);
  return (
    description.includes("message is not modified") ||
    description.includes("there is no text in the message to edit")
  );
};

const editMatchMessage = async (
  ctx: Context,
  text: string,
  options: Parameters<Context["editMessageText"]>[1]
): Promise<void> => {
  try {
    await ctx.editMessageText(text, options);
  } catch (error) {
    if (isBenignEditError(error)) {
      return;
    }
    await ctx.reply(text, options);
  }
};

const readyInlineOptions = () =>
  withHtml({ reply_markup: buildMatchSearchKeyboard() });

const formatPendingListHeader = (
  incomingCount: number,
  outgoingCount: number
): string =>
  MATCH_PENDING_LIST_HEADER.replace(
    "{incoming}",
    convertToPersianNumbers(String(incomingCount))
  ).replace("{outgoing}", convertToPersianNumbers(String(outgoingCount)));

export const sendPendingMatchRequests = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  await expireOldMatchRequests(env);
  const pending = await listPendingMatchRequests(userId, env);

  if (pending.incoming.length === 0 && pending.outgoing.length === 0) {
    await renderScreen(ctx, {
      text: MATCH_PENDING_EMPTY,
      replyMarkup: buildSuggestionHubBackKeyboard(),
    });
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  await ctx.reply(
    formatPendingListHeader(pending.incoming.length, pending.outgoing.length),
    withHtml({ reply_markup: buildSuggestionHubBackKeyboard() })
  );

  for (const request of pending.incoming) {
    const introText = await decryptMatchIntro(
      request.id,
      request.intro_ciphertext,
      env.APP_MASTER_KEY
    );
    const explanation = parseMatchExplanation(request.explanation_json);
    const qualityLabel = getMatchQualityLabel(request.score);
    await ctx.reply(
      formatIncomingMatchRequestMessage({
        score: request.score,
        qualityLabel,
        explanation,
        introText,
      }),
      withHtml({
        reply_markup: buildIncomingMatchRequestKeyboard(request.id),
      })
    );
  }

  for (const request of pending.outgoing) {
    const introText = await decryptMatchIntro(
      request.id,
      request.intro_ciphertext,
      env.APP_MASTER_KEY
    );
    const explanation = parseMatchExplanation(request.explanation_json);
    const qualityLabel = getMatchQualityLabel(request.score);
    await ctx.reply(
      formatOutgoingMatchRequestMessage({
        score: request.score,
        qualityLabel,
        explanation,
        introText,
      }),
      withHtml({
        reply_markup: buildOutgoingMatchRequestKeyboard(request.id),
      })
    );
  }
};

const runMatchSearch = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const profile = await getLatestAssessmentProfile(userId, env);
  if (!profile) {
    await renderSuggestionHub(ctx, env, userId);
    return;
  }

  const result = await findTopMatches(userId, env);
  await emitStat(env, STAT_EVENTS.SUGGESTION_SEARCH);
  if (!result.ok) {
    if (result.reason === "search_limit") {
      await editMatchMessage(ctx, MATCH_SEARCH_LIMIT, readyInlineOptions());
      return;
    }
    await renderSuggestionHub(ctx, env, userId);
    return;
  }

  if (result.candidates.length === 0) {
    const emptyMessage =
      result.reason === "recent_cooldown"
        ? MATCH_NO_CANDIDATES_COOLDOWN
        : MATCH_NO_CANDIDATES;
    await editMatchMessage(ctx, emptyMessage, readyInlineOptions());
    return;
  }

  const suggestions = await createMatchSuggestionBatch(
    userId,
    result.candidates,
    profile.version,
    env
  );

  if (suggestions.length === 0) {
    await editMatchMessage(ctx, MATCH_NO_CANDIDATES, readyInlineOptions());
    return;
  }

  const outdatedNote =
    profile && !isCurrentAssessmentVersion(profile.version)
      ? `\n\n${MATCH_PROFILE_VERSION_OUTDATED}`
      : "";

  const text =
    formatMatchCandidatesMessage(
      suggestions.map((s) => ({
        score: s.score,
        qualityLabel: getMatchQualityLabel(s.score),
        explanation: parseMatchExplanation(s.explanation_json),
      }))
    ) + outdatedNote;

  await editMatchMessage(ctx, text, {
    ...withHtml(),
    reply_markup: buildMatchResultsKeyboard(suggestions.map((s) => s.id)),
  });
};

export const handleMatchCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    await renderSuggestionHub(ctx, env, d1User.id);
  } catch (error) {
    logBotError("handleMatchCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleMatchIntroInput = async (
  ctx: Context,
  userId: string,
  suggestionId: string,
  env: Environment
): Promise<boolean> => {
  const message = ctx.message;
  const draftKeyboard = withHtml({
    reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.match_intro),
  });

  if (!message?.text) {
    await ctx.reply(MATCH_INTRO_TEXT_ONLY, draftKeyboard);
    return true;
  }

  const text = message.text.trim();
  if (!text) {
    await ctx.reply(MATCH_INTRO_EMPTY, draftKeyboard);
    return true;
  }

  if (text.length > MATCH_INTRO_MAX_CHARS) {
    await ctx.reply(MATCH_INTRO_TOO_LONG, draftKeyboard);
    return true;
  }

  const result = await createMatchRequest({
    requesterUserId: userId,
    suggestionId,
    introText: text,
    env,
  });

  await clearDraft(env, userId);

  if (!result.ok) {
    if (result.reason === "request_limit") {
      await ctx.reply(MATCH_REQUEST_LIMIT, { reply_markup: mainMenu });
    } else if (
      result.reason === "invalid_suggestion" ||
      result.reason === "candidate_unavailable"
    ) {
      await ctx.reply(MATCH_CANDIDATE_UNAVAILABLE, { reply_markup: mainMenu });
    } else if (result.reason === "pending_exists") {
      await ctx.reply(MATCH_PENDING_EXISTS, { reply_markup: mainMenu });
      await renderSuggestionHub(ctx, env, userId);
    } else if (result.reason === "already_accepted") {
      await ctx.reply(MATCH_REQUEST_ALREADY_ACCEPTED, withHtml({ reply_markup: mainMenu }));
    } else if (result.reason === "recent_pair_cooldown") {
      await ctx.reply(MATCH_RECENT_PAIR_COOLDOWN, { reply_markup: mainMenu });
      await renderSuggestionHub(ctx, env, userId);
    } else {
      await ctx.reply(HuhMessage, { reply_markup: mainMenu });
    }
    return true;
  }

  await ctx.reply(MATCH_REQUEST_SENT, withHtml({ reply_markup: mainMenu }));
  return true;
};

export const handleMatchCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    const userId = d1User.id;

    if (data === MATCH_CALLBACK.hub) {
      await renderSuggestionHub(ctx, env, userId);
      return;
    }

    if (data === MATCH_CALLBACK.pending) {
      await sendPendingMatchRequests(ctx, userId, env);
      return;
    }

    if (data === MATCH_CALLBACK.profile) {
      await sendMatchProfileScreen(ctx, userId, env);
      return;
    }

    if (data === MATCH_CALLBACK.enableDiscover) {
      const result = await enableDiscoverability(userId, env);
      if (!result.ok) {
        await ctx.answerCallbackQuery({ text: MATCH_OPT_IN });
        return;
      }
      await emitStat(env, STAT_EVENTS.DISCOVERABILITY_ENABLED);
      await renderSuggestionHub(ctx, env, userId);
      return;
    }

    if (data === MATCH_CALLBACK.disableDiscover) {
      await disableDiscoverability(userId, env);
      await emitStat(env, STAT_EVENTS.DISCOVERABILITY_DISABLED);
      await renderSuggestionHub(ctx, env, userId);
      return;
    }

    if (data === MATCH_CALLBACK.assessment) {
      await ctx.answerCallbackQuery();
      await sendAssessmentDashboard(ctx, userId, env);
      return;
    }

    if (data === MATCH_CALLBACK.search) {
      await ctx.answerCallbackQuery();
      await runMatchSearch(ctx, userId, env);
      return;
    }

    const requestMatch = /^m:req:([A-Za-z0-9_-]+)$/.exec(data);
    if (requestMatch) {
      const suggestionId = requestMatch[1];
      const suggestion = await getMatchSuggestion(suggestionId, userId, env);
      if (!suggestion) {
        await ctx.answerCallbackQuery({ text: MATCH_SUGGESTION_INVALID });
        return;
      }

      await ctx.answerCallbackQuery();
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      const prompt = await ctx.reply(
        MATCH_INTRO_PROMPT,
        withHtml({
          reply_markup: buildDraftCancelKeyboard(INPUT_PLACEHOLDERS.match_intro),
        })
      );
      await setDraft(env, userId, {
        id: "primary",
        mode: "match_intro",
        toUserId: suggestion.candidate_user_id,
        replyRef: suggestionId,
        parent_message_id: prompt.message_id,
      });
      return;
    }

    const acceptMatch = /^m:acc:([A-Za-z0-9_-]+)$/.exec(data);
    if (acceptMatch) {
      const requestId = acceptMatch[1];
      const result = await acceptMatchRequest(requestId, userId, env);
      await ctx.answerCallbackQuery();
      if (result.duplicate) {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(MATCH_ACCEPTED_CANDIDATE, withHtml({ reply_markup: mainMenu }));
        return;
      }
      if (!result.ok) {
        const msg =
          result.reason === "expired"
            ? MATCH_REQUEST_EXPIRED
            : result.reason === "ineligible" ||
                result.reason === "send_failed"
              ? MATCH_CANDIDATE_UNAVAILABLE
              : MATCH_REQUEST_ALREADY_HANDLED;
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(msg, { reply_markup: mainMenu });
        return;
      }
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(MATCH_ACCEPTED_CANDIDATE, withHtml({ reply_markup: mainMenu }));
      return;
    }

    const declineMatch = /^m:dec:([A-Za-z0-9_-]+)$/.exec(data);
    if (declineMatch) {
      const requestId = declineMatch[1];
      const result = await declineMatchRequest(requestId, userId, env);
      await ctx.answerCallbackQuery();
      if (!result.ok && !result.duplicate) {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(MATCH_REQUEST_ALREADY_HANDLED, { reply_markup: mainMenu });
        return;
      }
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(MATCH_DECLINED_CANDIDATE, { reply_markup: mainMenu });
      return;
    }

    const cancelMatch = /^m:can:([A-Za-z0-9_-]+)$/.exec(data);
    if (cancelMatch) {
      const requestId = cancelMatch[1];
      const result = await cancelMatchRequest(requestId, userId, env);
      await ctx.answerCallbackQuery();
      if (!result.ok && !result.duplicate) {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(MATCH_REQUEST_CANCEL_FAILED, { reply_markup: mainMenu });
        return;
      }
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      await ctx.reply(MATCH_REQUEST_CANCELLED, { reply_markup: mainMenu });
      return;
    }
  } catch (error) {
    logBotError("handleMatchCallback", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

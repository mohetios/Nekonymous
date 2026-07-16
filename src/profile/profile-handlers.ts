import type { Context } from "grammy";
import type { Environment } from "../types/runtime.env";
import {
  answerCallbackSafely,
  deferContextWork,
  getResolvedUser,
} from "../bot/context";
import { mainMenu } from "../bot/keyboards";
import { renderScreen } from "../bot/render-screen";
import { HuhMessage } from "../i18n/messages";
import {
  PROFILE_COMPLETION_NOTE,
  PROFILE_DASHBOARD_INTRO,
  PROFILE_DASHBOARD_READY_INTRO,
  PROFILE_EXIT_SAVED,
  PROFILE_RESET_CONFIRM,
  PROFILE_RESULT_READY_TITLE,
  PROFILE_STATUS_HEADER,
  PROFILE_SUBMIT_READY,
} from "../i18n/conversation-profile-ui";
import {
  recordProfileStarted,
  recordProfileCompleted,
} from "../stats/product-events";
import { escapeHtml, withHtml } from "../utils/text";
import { logBotError } from "../utils/logs";
import { renderSuggestionHub } from "../suggestions/suggestion-hub";
import { PROFILE_CALLBACK } from "./profile-constants.ts";
import {
  buildProfileDashboardKeyboard,
  buildQuestionKeyboard,
  buildResetConfirmKeyboard,
  buildResultKeyboard,
  dashboardStatusLine,
  formatQuestionMessage,
  resumeQuestionIndex,
} from "./profile-keyboards.ts";
import {
  getProfileSession,
  getProfileSessionProgress,
  profileSessionIsReady,
  saveProfileAnswer,
  setProfileCurrentIndex,
  startProfileSession,
} from "./profile-session-service.ts";
import {
  finalizeProfileSession,
  hasFinalizedProfile,
  prepareProfileRetake,
} from "./profile-service.ts";
import { PROFILE_QUESTION_BY_INDEX, PROFILE_QUESTIONS } from "./profile-question-bank.ts";
import {
  assertValidAnswerPatch,
  isConversationIntent,
} from "./profile-validation.ts";

const parseAnswerCallback = (
  data: string
): { index: number; value: number } | null => {
  const match = /^t:a:(\d+):(\d+)$/.exec(data);
  if (!match) {
    return null;
  }
  return {
    index: Number(match[1]),
    value: Number(match[2]),
  };
};

const parseIntentCallback = (data: string): string | null => {
  const match = /^t:i:(.+)$/.exec(data);
  return match?.[1] ?? null;
};

export const sendProfileDashboard = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const [session, hasProfile] = await Promise.all([
    getProfileSession(env, userId),
    hasFinalizedProfile(env, userId),
  ]);

  const progress = session
    ? getProfileSessionProgress(session)
    : { answered: 0, total: 25 };
  const status = dashboardStatusLine({
    hasProfile,
    hasSession: !!session,
    answeredCount: progress.answered,
  });

  const intro =
    hasProfile && !session
      ? PROFILE_DASHBOARD_READY_INTRO
      : PROFILE_DASHBOARD_INTRO;
  const text =
    `${intro}\n\n` +
    `<b>${PROFILE_STATUS_HEADER}</b>\n${escapeHtml(status)}`;

  await renderScreen(ctx, {
    text,
    replyMarkup: buildProfileDashboardKeyboard({
      hasProfile,
      hasSession: !!session,
      readyToSubmit: session ? profileSessionIsReady(session) : false,
    }),
  });
};

const showQuestion = async (ctx: Context, index: number): Promise<void> =>
  renderScreen(ctx, {
    text: formatQuestionMessage(index),
    replyMarkup: buildQuestionKeyboard(index),
  });

const showSubmitPrompt = async (ctx: Context): Promise<void> =>
  renderScreen(ctx, {
    text: PROFILE_SUBMIT_READY,
    replyMarkup: buildProfileDashboardKeyboard({
      hasProfile: false,
      hasSession: true,
      readyToSubmit: true,
    }),
  });

const startNewProfileSession = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  await prepareProfileRetake(env, userId);
  await startProfileSession(env, userId);
  await deferContextWork(ctx, recordProfileStarted(env));
  await showQuestion(ctx, 0);
};

const completeProfile = async (
  ctx: Context,
  userId: string,
  env: Environment,
  actorHash: string
): Promise<void> => {
  const result = await finalizeProfileSession(env, userId, actorHash, "fa");
  await deferContextWork(ctx, recordProfileCompleted(env));

  const summary = escapeHtml(result.summaryText);
  const text =
    `${PROFILE_RESULT_READY_TITLE}\n\n${summary}${PROFILE_COMPLETION_NOTE}`;

  await renderScreen(ctx, {
    text,
    replyMarkup: buildResultKeyboard(),
  });
};

export const handleAssessmentCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const user = await getResolvedUser(ctx, env);
    await sendProfileDashboard(ctx, user.id, env);
  } catch (error) {
    logBotError("profile.command", error);
    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  }
};

export const handleAssessmentCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  const data = ctx.callbackQuery?.data;
  if (!from || !data) {
    await answerCallbackSafely(ctx);
    return;
  }

  await answerCallbackSafely(ctx);

  try {
    const user = await getResolvedUser(ctx, env);

    if (data === PROFILE_CALLBACK.hub) {
      await renderSuggestionHub(ctx, env);
      return;
    }

    if (data === PROFILE_CALLBACK.start || data === PROFILE_CALLBACK.continue) {
      const session = await getProfileSession(env, user.id);
      if (!session || data === PROFILE_CALLBACK.start) {
        await startNewProfileSession(ctx, user.id, env);
        return;
      }
      const index = resumeQuestionIndex(session);
      if (profileSessionIsReady(session)) {
        await showSubmitPrompt(ctx);
      } else {
        await showQuestion(ctx, index);
      }
      return;
    }

    if (data === PROFILE_CALLBACK.exit) {
      await ctx.reply(PROFILE_EXIT_SAVED, withHtml({ reply_markup: mainMenu }));
      return;
    }

    if (data === PROFILE_CALLBACK.reset) {
      await renderScreen(ctx, {
        text: PROFILE_RESET_CONFIRM,
        replyMarkup: buildResetConfirmKeyboard(),
      });
      return;
    }

    if (data === PROFILE_CALLBACK.resetNo) {
      await sendProfileDashboard(ctx, user.id, env);
      return;
    }

    if (data === PROFILE_CALLBACK.resetYes) {
      await startNewProfileSession(ctx, user.id, env);
      return;
    }

    if (data === PROFILE_CALLBACK.submit) {
      await completeProfile(ctx, user.id, env, user.telegram_user_hash);
      return;
    }

    if (data === PROFILE_CALLBACK.previous) {
      const session = await getProfileSession(env, user.id);
      if (!session) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      const index = Math.max(0, session.currentIndex - 1);
      await setProfileCurrentIndex(env, user.id, index);
      await showQuestion(ctx, index);
      return;
    }

    const intent = parseIntentCallback(data);
    if (intent) {
      const question = PROFILE_QUESTIONS[PROFILE_QUESTIONS.length - 1];
      if (!question || !isConversationIntent(intent)) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      assertValidAnswerPatch(question.id, intent);
      const updated = await saveProfileAnswer(
        env,
        user.id,
        question.id,
        intent,
        question.index
      );
      if (!updated) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      if (profileSessionIsReady(updated)) {
        await showSubmitPrompt(ctx);
      } else {
        await showQuestion(ctx, updated.currentIndex);
      }
      return;
    }

    const answer = parseAnswerCallback(data);
    if (answer) {
      const question = PROFILE_QUESTION_BY_INDEX.get(answer.index);
      if (!question) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      assertValidAnswerPatch(question.id, answer.value);
      const updated = await saveProfileAnswer(
        env,
        user.id,
        question.id,
        answer.value,
        answer.index
      );
      if (!updated) {
        await sendProfileDashboard(ctx, user.id, env);
        return;
      }
      if (profileSessionIsReady(updated)) {
        await showSubmitPrompt(ctx);
      } else if (updated.currentIndex >= PROFILE_QUESTIONS.length) {
        await showSubmitPrompt(ctx);
      } else {
        await showQuestion(ctx, updated.currentIndex);
      }
      return;
    }

    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  } catch (error) {
    logBotError("profile.callback", error);
    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  }
};

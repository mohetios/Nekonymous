import { InlineKeyboard, type Context } from "grammy";
import type { Environment } from "../types";
import { logBotError } from "../utils/logs";
import { HuhMessage } from "../utils/messages";
import { mainMenu, MENU } from "../utils/constant";
import {
  convertToPersianNumbers,
  escapeHtml,
  withHtml,
} from "../utils/tools";
import { resolveOrCreateUser } from "../services/identity-service";
import {
  cancelTestSession,
  getTestSession,
  resetTestSession,
  saveTestAnswer,
  setTestCurrentIndex,
  startTestSession,
} from "../services/user-state-service";
import { TEST_CALLBACK } from "../features/test/constants";
import {
  buildQuestionKeyboard,
  buildResetConfirmKeyboard,
  buildResultKeyboard,
  buildTestDashboardKeyboard,
  dashboardStatusLine,
  formatQuestionMessage,
  TEST_DASHBOARD_INTRO,
  TEST_EXIT_SAVED,
  TEST_FUTURE_MATCHING_NOTE,
  TEST_RESET_CONFIRM,
} from "../features/test/keyboards";
import {
  completeTestFlow,
  resumeQuestionIndex,
  scheduleProfileIndexing,
} from "../features/test/test-flow-service";
import {
  abandonActiveTestAttempts,
  createTestAttempt,
  getLatestTestProfile,
  parseResultSummary,
  profileScoresFromRow,
} from "../features/test/test-profile-service";
import {
  CORE_DIMENSION_LABELS,
  type TestResultSummary,
  type TestScores,
} from "../features/test/scoring";
import {
  TEST_QUESTIONS,
  TEST_QUESTION_COUNT,
  TEST_VERSION,
} from "../features/test/question-bank";
import type { NekoContext } from "../utils/worker";

const formatPercent = (value: number): string =>
  convertToPersianNumbers(`${Math.round(value)}٪`);

const formatResultMessage = (
  summary: TestResultSummary,
  scores: TestScores,
  includeScores: boolean
): string => {
  const highlights = summary.highlights
    .map((line) => `• ${escapeHtml(line)}`)
    .join("\n");
  const cautions = summary.cautions
    .map((line) => `• ${escapeHtml(line)}`)
    .join("\n");

  let text =
    "✅ <b>نتیجه تست آماده شد</b>\n\n" +
    `<b>${escapeHtml(summary.title)}</b>\n\n` +
    `${escapeHtml(summary.shortDescription)}\n\n` +
    `<b>چند سیگنال اصلی:</b>\n${highlights}\n\n` +
    `<b>چند نکته برای گفت‌وگو:</b>\n${cautions}\n\n` +
    "این نتیجه برای کمک به پیشنهادهای آینده استفاده می‌شود، نه برای تشخیص روان‌شناسی." +
    TEST_FUTURE_MATCHING_NOTE;

  if (includeScores) {
    const scoreLines = (
      Object.keys(CORE_DIMENSION_LABELS) as Array<
        keyof typeof CORE_DIMENSION_LABELS
      >
    )
      .map(
        (key) =>
          `${CORE_DIMENSION_LABELS[key]}: ${formatPercent(scores[key])}`
      )
      .join("\n");

    text += `\n\n<b>نمای کلی:</b>\n${escapeHtml(scoreLines)}`;
  }

  return text;
};

const sendDashboard = async (
  ctx: Context,
  userId: string,
  env: Environment,
  edit = false
): Promise<void> => {
  const [session, profile] = await Promise.all([
    getTestSession(userId, env),
    getLatestTestProfile(userId, env),
  ]);

  const answeredCount = session ? Object.keys(session.answers).length : 0;

  const status = dashboardStatusLine({
    hasProfile: !!profile,
    hasSession: !!session,
    answeredCount,
  });

  const text =
    `${TEST_DASHBOARD_INTRO}\n\n` +
    `<b>وضعیت:</b>\n${escapeHtml(status)}`;

  const keyboard = buildTestDashboardKeyboard({
    hasProfile: !!profile,
    hasSession: !!session,
  });

  const options = withHtml({ reply_markup: keyboard });

  if (edit && ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, options);
  } else {
    await ctx.reply(text, options);
  }
};

const showQuestion = async (
  ctx: Context,
  index: number,
  edit: boolean
): Promise<void> => {
  const text = formatQuestionMessage(index);
  const keyboard = buildQuestionKeyboard(index);
  const options = { reply_markup: keyboard };

  if (edit && ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, options);
  } else {
    await ctx.reply(text, options);
  }
};

const startNewTest = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  await resetTestSession(userId, env);
  await abandonActiveTestAttempts(userId, env);
  const attemptId = await createTestAttempt(
    userId,
    TEST_VERSION,
    TEST_QUESTION_COUNT,
    env
  );
  await startTestSession(
    userId,
    TEST_VERSION,
    TEST_QUESTION_COUNT,
    attemptId,
    env
  );
  const session = await getTestSession(userId, env);
  if (!session) {
    throw new Error("Failed to start test session");
  }
  await showQuestion(ctx, 0, !!ctx.callbackQuery);
};

export const handleTestCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  try {
    const d1User = await resolveOrCreateUser(ctx, env);
    await sendDashboard(ctx, d1User.id, env);
  } catch (error) {
    logBotError("handleTestCommand", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

export const handleTestMenu = async (
  ctx: Context,
  env: Environment
): Promise<boolean> => {
  if (ctx.message?.text !== MENU.test) {
    return false;
  }

  await handleTestCommand(ctx, env);
  return true;
};

export const handleTestCallback = async (
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
    const locale = d1User.locale || "fa";

    await ctx.answerCallbackQuery();

    if (data === TEST_CALLBACK.start || data === TEST_CALLBACK.continue) {
      let session = await getTestSession(userId, env);
      if (!session || data === TEST_CALLBACK.start) {
        await startNewTest(ctx, userId, env);
        return;
      }
      const index = resumeQuestionIndex(session);
      await setTestCurrentIndex(userId, index, env);
      session = (await getTestSession(userId, env)) ?? session;
      await showQuestion(ctx, index, true);
      return;
    }

    if (data === TEST_CALLBACK.menu) {
      await sendDashboard(ctx, userId, env, true);
      return;
    }

    if (data === TEST_CALLBACK.exit) {
      await cancelTestSession(userId, env);
      await ctx.editMessageText(TEST_EXIT_SAVED, {
        reply_markup: new InlineKeyboard().text(
          "بازگشت به منو",
          TEST_CALLBACK.menu
        ),
      });
      return;
    }

    if (data === TEST_CALLBACK.reset) {
      await ctx.editMessageText(TEST_RESET_CONFIRM, {
        reply_markup: buildResetConfirmKeyboard(),
      });
      return;
    }

    if (data === TEST_CALLBACK.resetNo) {
      await sendDashboard(ctx, userId, env, true);
      return;
    }

    if (data === TEST_CALLBACK.resetYes) {
      await resetTestSession(userId, env);
      await startNewTest(ctx, userId, env);
      return;
    }

    if (data === TEST_CALLBACK.result) {
      const profile = await getLatestTestProfile(userId, env);
      if (!profile) {
        await sendDashboard(ctx, userId, env, true);
        return;
      }
      const summary = parseResultSummary(profile);
      const scores = profileScoresFromRow(profile);
      const text = formatResultMessage(summary, scores, true);
      await ctx.editMessageText(text, {
        ...withHtml(),
        reply_markup: buildResultKeyboard(),
      });
      return;
    }

    if (data === TEST_CALLBACK.previous) {
      const session = await getTestSession(userId, env);
      if (!session) {
        await sendDashboard(ctx, userId, env, true);
        return;
      }
      const index = Math.max(0, session.currentIndex - 1);
      await setTestCurrentIndex(userId, index, env);
      await showQuestion(ctx, index, true);
      return;
    }

    const answerMatch = /^t:a:(\d+):([1-5])$/.exec(data);
    if (answerMatch) {
      const index = Number(answerMatch[1]);
      const value = Number(answerMatch[2]);
      const session = await getTestSession(userId, env);
      if (!session || !session.attemptId) {
        await sendDashboard(ctx, userId, env, true);
        return;
      }

      const question = TEST_QUESTIONS[index];
      if (!question) {
        return;
      }

      await saveTestAnswer(userId, question.id, value, env, index);

      const updated = await getTestSession(userId, env);
      if (!updated) {
        return;
      }

      const answeredCount = Object.keys(updated.answers).length;
      if (answeredCount >= TEST_QUESTION_COUNT) {
        const result = await completeTestFlow(userId, locale, env);
        const text = formatResultMessage(
          result.summary,
          result.scores,
          true
        );
        await ctx.editMessageText(text, {
          ...withHtml(),
          reply_markup: buildResultKeyboard(),
        });

        const localeCode = locale === "en" ? "en" : "fa";
        scheduleProfileIndexing(
          {
            userId,
            version: result.version,
            locale: localeCode,
            scores: result.scores,
            summary: result.summary,
            profileSummaryText: result.profileSummaryText,
            env,
          },
          (ctx as NekoContext).deferWork
        );
        return;
      }

      const nextIndex = index + 1;
      await setTestCurrentIndex(userId, nextIndex, env);
      await showQuestion(ctx, nextIndex, true);
      return;
    }

    await sendDashboard(ctx, userId, env, true);
  } catch (error) {
    logBotError("handleTestCallback", error);
    await ctx.reply(HuhMessage, { reply_markup: mainMenu });
  }
};

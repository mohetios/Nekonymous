import { InlineKeyboard } from "grammy";
import { ASSESSMENT_BUTTON } from "../../../i18n/labels";
import {
  PROFILE_DESIRED_GUIDES,
  PROFILE_INTENT_OPTIONS,
  PROFILE_SELF_ANSWER_CHOICES,
  PROFILE_SUBMIT_BUTTON,
  formatProfileQuestionHeader,
  PROFILE_ANSWER_SCALE,
  type ProfileAnswerChoice,
} from "../../../i18n/conversation-profile-ui";
import { escapeHtml } from "../../../utils/text";
import { PROFILE_CALLBACK, PROFILE_QUESTION_COUNT } from "./constants.ts";
import { PROFILE_QUESTION_BY_INDEX, PROFILE_QUESTIONS } from "./question-bank.ts";
import { formatProfileSessionStatus } from "../../../i18n/conversation-profile-ui";

export const dashboardStatusLine = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => formatProfileSessionStatus(options);

export const buildProfileDashboardKeyboard = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  readyToSubmit?: boolean;
}): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (options.readyToSubmit) {
    keyboard.text(PROFILE_SUBMIT_BUTTON, PROFILE_CALLBACK.submit).row();
  }

  if (options.hasSession) {
    keyboard
      .text(ASSESSMENT_BUTTON.continue, PROFILE_CALLBACK.continue)
      .text(ASSESSMENT_BUTTON.restart, PROFILE_CALLBACK.reset);
  } else if (options.hasProfile) {
    keyboard.text(ASSESSMENT_BUTTON.restart, PROFILE_CALLBACK.reset);
  } else {
    keyboard.text(ASSESSMENT_BUTTON.start, PROFILE_CALLBACK.start);
  }

  keyboard.row().text(ASSESSMENT_BUTTON.backToSuggestions, PROFILE_CALLBACK.hub);
  return keyboard;
};

export const buildResetConfirmKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(ASSESSMENT_BUTTON.resetYes, PROFILE_CALLBACK.resetYes)
    .text(ASSESSMENT_BUTTON.resetNo, PROFILE_CALLBACK.resetNo);

export const buildResultKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(ASSESSMENT_BUTTON.restart, PROFILE_CALLBACK.reset)
    .row()
    .text(ASSESSMENT_BUTTON.backToSuggestions, PROFILE_CALLBACK.hub);

const answerRow = (
  keyboard: InlineKeyboard,
  index: number,
  choices: ProfileAnswerChoice[]
): InlineKeyboard => {
  for (const choice of choices) {
    keyboard.text(choice.label, PROFILE_CALLBACK.answer(index, choice.value));
  }
  return keyboard.row();
};

export const buildQuestionKeyboard = (index: number): InlineKeyboard => {
  const question = PROFILE_QUESTION_BY_INDEX.get(index);
  const keyboard = new InlineKeyboard();

  if (!question) {
    return keyboard;
  }

  if (question.kind === "intent") {
    for (const [intent, label] of Object.entries(PROFILE_INTENT_OPTIONS)) {
      keyboard.text(label, PROFILE_CALLBACK.intent(intent)).row();
    }
    if (index > 0) {
      keyboard.text(ASSESSMENT_BUTTON.previous, PROFILE_CALLBACK.previous);
    }
    keyboard.text(ASSESSMENT_BUTTON.exit, PROFILE_CALLBACK.exit);
    return keyboard;
  }

  answerRow(keyboard, index, PROFILE_SELF_ANSWER_CHOICES);

  if (index > 0) {
    keyboard.text(ASSESSMENT_BUTTON.previous, PROFILE_CALLBACK.previous);
  }
  keyboard.text(ASSESSMENT_BUTTON.exit, PROFILE_CALLBACK.exit);
  return keyboard;
};

export const formatQuestionMessage = (index: number): string => {
  const question = PROFILE_QUESTION_BY_INDEX.get(index);
  if (!question) {
    return "این سؤال در دسترس نیست.";
  }

  const header = formatProfileQuestionHeader(index + 1, PROFILE_QUESTION_COUNT);
  const scale =
    question.kind === "desired" && question.dimension
      ? PROFILE_DESIRED_GUIDES[question.dimension]
      : question.kind === "self"
        ? PROFILE_ANSWER_SCALE
        : "";
  const scaleBlock = scale ? `\n\n${escapeHtml(scale)}` : "";

  return `<b>${escapeHtml(header)}</b>\n\n${escapeHtml(question.text)}${scaleBlock}`;
};

export const resumeQuestionIndex = (session: {
  currentIndex: number;
  answers: Record<string, number | string>;
}): number => {
  for (let index = 0; index < PROFILE_QUESTIONS.length; index += 1) {
    const question = PROFILE_QUESTIONS[index];
    if (!question) {
      continue;
    }
    if (session.answers[question.id] === undefined) {
      return index;
    }
  }
  return Math.min(session.currentIndex, PROFILE_QUESTIONS.length - 1);
};

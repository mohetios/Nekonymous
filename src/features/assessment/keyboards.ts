import { InlineKeyboard } from "grammy";
import { ASSESSMENT_CALLBACK } from "./constants";
import {
  getQuestionAtIndex,
  ASSESSMENT_QUESTION_COUNT,
} from "./question-bank";
import { assertCallbackData } from "../../utils/telegram-limits";
import {
  ASSESSMENT_ANSWER_SCALE,
  ASSESSMENT_QUESTION_NOT_FOUND,
  formatAssessmentQuestionHeader,
  formatAssessmentSessionStatus,
} from "../../i18n/assessment-ui";
import { ASSESSMENT_BUTTON } from "../../i18n/labels";

export {
  ASSESSMENT_ANSWER_SCALE,
  ASSESSMENT_COMPLETION_NOTE,
  ASSESSMENT_DASHBOARD_INTRO,
  ASSESSMENT_EXIT_SAVED,
  ASSESSMENT_RESET_CONFIRM,
  ASSESSMENT_VERSION_OUTDATED_NOTE,
} from "../../i18n/assessment-ui";

export const buildAssessmentDashboardKeyboard = (options: {
  hasProfile: boolean;
  hasSession: boolean;
}): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (!options.hasSession && !options.hasProfile) {
    keyboard.text(ASSESSMENT_BUTTON.start, ASSESSMENT_CALLBACK.start);
    return keyboard;
  }

  if (options.hasSession) {
    keyboard
      .text(ASSESSMENT_BUTTON.continue, ASSESSMENT_CALLBACK.continue)
      .text(ASSESSMENT_BUTTON.restart, ASSESSMENT_CALLBACK.reset);
    return keyboard;
  }

  if (options.hasProfile) {
    keyboard
      .text(ASSESSMENT_BUTTON.viewResult, ASSESSMENT_CALLBACK.result)
      .text(ASSESSMENT_BUTTON.restart, ASSESSMENT_CALLBACK.reset);
  }

  return keyboard;
};

export const buildResetConfirmKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(ASSESSMENT_BUTTON.resetYes, ASSESSMENT_CALLBACK.resetYes)
    .text(ASSESSMENT_BUTTON.resetNo, ASSESSMENT_CALLBACK.resetNo);

export const buildQuestionKeyboard = (index: number): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  for (let value = 1; value <= 5; value++) {
    const data = ASSESSMENT_CALLBACK.answer(index, value);
    assertCallbackData(data);
    keyboard.text(String(value), data);
  }

  keyboard.row();

  if (index > 0) {
    keyboard.text(ASSESSMENT_BUTTON.previous, ASSESSMENT_CALLBACK.previous);
  }

  keyboard.text(ASSESSMENT_BUTTON.exit, ASSESSMENT_CALLBACK.exit);

  return keyboard;
};

export const buildResultKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(ASSESSMENT_BUTTON.viewResultAgain, ASSESSMENT_CALLBACK.result)
    .text(ASSESSMENT_BUTTON.restart, ASSESSMENT_CALLBACK.reset)
    .row()
    .text(ASSESSMENT_BUTTON.backToMenu, ASSESSMENT_CALLBACK.menu);

export const formatQuestionMessage = (index: number): string => {
  const question = getQuestionAtIndex(index);
  if (!question) {
    return ASSESSMENT_QUESTION_NOT_FOUND;
  }

  const current = index + 1;
  return (
    `${formatAssessmentQuestionHeader(current, ASSESSMENT_QUESTION_COUNT)}\n\n` +
    `${question.text}\n\n` +
    ASSESSMENT_ANSWER_SCALE
  );
};

export const dashboardStatusLine = (options: {
  hasProfile: boolean;
  hasSession: boolean;
  answeredCount: number;
}): string => formatAssessmentSessionStatus(options);

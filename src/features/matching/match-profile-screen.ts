import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { Environment } from "../../types";
import { renderScreen } from "../../bot/render-screen";
import { BACK_BUTTON, MENU } from "../../i18n/labels";
import { getLatestAssessmentProfile } from "../assessment/assessment-profile-service";
import { formatMatchProfileMessage } from "./match-profile-view";
import { buildSuggestionHubBackKeyboard } from "./keyboards";
import { MATCH_CALLBACK } from "./constants";

export const sendMatchProfileScreen = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<void> => {
  const profile = await getLatestAssessmentProfile(userId, env);
  const { text, hasProfile } = formatMatchProfileMessage(profile);

  if (!hasProfile) {
    const keyboard = new InlineKeyboard()
      .text(MENU.matchAssessment, MATCH_CALLBACK.assessment)
      .row()
      .text(BACK_BUTTON.toSuggestions, MATCH_CALLBACK.hub);
    await renderScreen(ctx, { text, replyMarkup: keyboard });
    return;
  }

  await renderScreen(ctx, {
    text,
    replyMarkup: buildSuggestionHubBackKeyboard(),
  });
};

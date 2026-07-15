import { InlineKeyboard } from "grammy";
import { SUGGESTION_CALLBACK, SUGGESTION_HUB_CALLBACK } from "./suggestion-constants";
import { SUGGESTION_BUTTON, MENU, BACK_BUTTON } from "../i18n/labels";
import type { SuggestionHubMenuOptions } from "./suggestion-types";

export const buildSuggestionHubKeyboard = (
  options: SuggestionHubMenuOptions & { showPending: boolean }
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (options.showFind) {
    keyboard.text(SUGGESTION_BUTTON.search, SUGGESTION_HUB_CALLBACK.search).row();
  }

  if (options.showPending) {
    keyboard.text(SUGGESTION_BUTTON.pending, SUGGESTION_HUB_CALLBACK.pending);
    keyboard.row();
  }

  if (options.discoverabilityVariant === "can_disable") {
    keyboard
      .text(MENU.matchDisable, SUGGESTION_HUB_CALLBACK.disableDiscover)
      .row();
  } else if (options.discoverabilityVariant === "can_enable") {
    keyboard
      .text(MENU.matchEnable, SUGGESTION_HUB_CALLBACK.enableDiscover)
      .row();
  }

  keyboard.text(options.assessmentLabel, SUGGESTION_HUB_CALLBACK.assessment);

  return keyboard;
};

export const buildSuggestionCandidateKeyboard = (
  suggestionRef: string,
  index = 0
): InlineKeyboard =>
  new InlineKeyboard()
    .text(SUGGESTION_BUTTON.writeIntro(index), SUGGESTION_CALLBACK.request(suggestionRef))
    .text(SUGGESTION_BUTTON.dismiss, SUGGESTION_CALLBACK.dismiss(suggestionRef))
    .row()
    .text(BACK_BUTTON.toSuggestions, SUGGESTION_HUB_CALLBACK.hub);

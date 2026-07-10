import { InlineKeyboard } from "grammy";
import { MATCH_CALLBACK } from "./constants";
import type { MatchQualityLabel } from "./match-types";
import { assertCallbackData } from "../../utils/telegram-limits";
import { convertToPersianNumbers, escapeHtml } from "../../utils/tools";
import {
  MATCH_CANDIDATES_COUNT_FOUND,
  MATCH_CANDIDATES_HEADER,
  MATCH_CANDIDATES_SINGLE_ONLY,
  MATCH_CANDIDATES_WHY_FIT,
  MATCH_INCOMING_ACCEPT_NOTE,
  MATCH_INCOMING_INTRO_LABEL,
  MATCH_INCOMING_WHY_FIT,
  MATCH_LIMITED_SIMILARITY_NOTE,
  MATCH_OUTGOING_INTRO_LABEL,
  MATCH_OUTGOING_WAIT_NOTE,
  MATCH_PENDING_INCOMING_LABEL,
  MATCH_PENDING_OUTGOING_LABEL,
  MATCH_QUALITY_COPY,
  MATCH_SIMILARITY_DISCLAIMER,
  formatMatchRequestSimilarityLine,
} from "../../i18n/matching";
import { BACK_BUTTON, MATCH_BUTTON, MENU } from "../../i18n/labels";
import type { MatchHubMenuOptions } from "./match-types";

export const buildSuggestionHubKeyboard = (
  options: MatchHubMenuOptions & { showPending: boolean }
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (options.showFind) {
    keyboard.text(MATCH_BUTTON.search, MATCH_CALLBACK.search).row();
  }

  if (options.showPending || options.showProfile) {
    if (options.showPending) {
      keyboard.text(MATCH_BUTTON.pending, MATCH_CALLBACK.pending);
    }
    if (options.showProfile) {
      keyboard.text(MATCH_BUTTON.profile, MATCH_CALLBACK.profile);
    }
    keyboard.row();
  }

  if (options.discoverabilityVariant === "can_disable") {
    keyboard.text(MENU.matchDisable, MATCH_CALLBACK.disableDiscover).row();
  } else if (options.discoverabilityVariant === "can_enable") {
    keyboard.text(MENU.matchEnable, MATCH_CALLBACK.enableDiscover).row();
  }

  keyboard.text(options.assessmentLabel, MATCH_CALLBACK.assessment);

  return keyboard;
};

export const buildSuggestionHubBackKeyboard = (): InlineKeyboard =>
  new InlineKeyboard().text(
    BACK_BUTTON.toSuggestions,
    MATCH_CALLBACK.hub
  );

/** Inline search trigger on candidate results screens. */
export const buildMatchSearchKeyboard = (): InlineKeyboard =>
  new InlineKeyboard()
    .text(MATCH_BUTTON.search, MATCH_CALLBACK.search)
    .row()
    .text(BACK_BUTTON.toSuggestions, MATCH_CALLBACK.hub);

export const buildIncomingMatchRequestKeyboard = (
  requestId: string
): InlineKeyboard => {
  const acceptData = MATCH_CALLBACK.accept(requestId);
  const declineData = MATCH_CALLBACK.decline(requestId);
  assertCallbackData(acceptData);
  assertCallbackData(declineData);
  return new InlineKeyboard()
    .text(MATCH_BUTTON.accept, acceptData)
    .text(MATCH_BUTTON.decline, declineData);
};

export const buildOutgoingMatchRequestKeyboard = (
  requestId: string
): InlineKeyboard => {
  const cancelData = MATCH_CALLBACK.cancel(requestId);
  assertCallbackData(cancelData);
  return new InlineKeyboard().text(MATCH_BUTTON.cancelRequest, cancelData);
};

const formatMatchRequestReasons = (reasons: string[]): string =>
  reasons
    .slice(0, 2)
    .map((r) => `- ${escapeHtml(r)}`)
    .join("\n");

export const formatIncomingMatchRequestMessage = (params: {
  score: number;
  qualityLabel: MatchQualityLabel;
  explanation: { reasons: string[] };
  introText: string;
}): string => {
  const similarityLine = escapeHtml(
    formatMatchRequestSimilarityLine(params.qualityLabel)
  );

  return (
    `${MATCH_PENDING_INCOMING_LABEL}\n\n` +
    `${similarityLine}\n\n` +
    `<i>${escapeHtml(MATCH_SIMILARITY_DISCLAIMER)}</i>\n\n` +
    `${MATCH_INCOMING_WHY_FIT}\n` +
    `${formatMatchRequestReasons(params.explanation.reasons)}\n\n` +
    `${MATCH_INCOMING_INTRO_LABEL}\n` +
    `«${escapeHtml(params.introText)}»\n\n` +
    MATCH_INCOMING_ACCEPT_NOTE
  );
};

export const formatOutgoingMatchRequestMessage = (params: {
  score: number;
  qualityLabel: MatchQualityLabel;
  explanation: { reasons: string[] };
  introText: string;
}): string => {
  const similarityLine = escapeHtml(
    formatMatchRequestSimilarityLine(params.qualityLabel)
  );

  return (
    `${MATCH_PENDING_OUTGOING_LABEL}\n\n` +
    `${similarityLine}\n\n` +
    `${MATCH_OUTGOING_INTRO_LABEL}\n` +
    `«${escapeHtml(params.introText)}»\n\n` +
    MATCH_OUTGOING_WAIT_NOTE
  );
};

export const buildMatchResultsKeyboard = (
  suggestionIds: string[]
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  suggestionIds.forEach((id, index) => {
    const data = MATCH_CALLBACK.request(id);
    assertCallbackData(data);
    keyboard.text(MATCH_BUTTON.writeIntro(index), data).row();
  });

  keyboard.text(MATCH_BUTTON.dismiss, MATCH_CALLBACK.hub);
  return keyboard;
};

export const formatMatchCandidatesMessage = (
  candidates: Array<{
    score: number;
    qualityLabel: MatchQualityLabel;
    explanation: { title: string; reasons: string[] };
  }>
): string => {
  const count = candidates.length;
  let text =
    `${MATCH_CANDIDATES_HEADER}\n\n` +
    `${MATCH_CANDIDATES_COUNT_FOUND(convertToPersianNumbers(String(count)))}\n` +
    `${MATCH_SIMILARITY_DISCLAIMER}\n`;

  if (count === 1) {
    text += `\n${MATCH_CANDIDATES_SINGLE_ONLY}\n`;
  }

  text += "\n";

  candidates.forEach((candidate, index) => {
    const reasons = candidate.explanation.reasons
      .slice(0, 2)
      .map((r) => `- ${r}`)
      .join("\n");

    const qualityLabel = MATCH_QUALITY_COPY[candidate.qualityLabel];

    text +=
      `${convertToPersianNumbers(String(index + 1))}) ${qualityLabel}\n\n` +
      `${candidate.explanation.title}\n\n` +
      `${MATCH_CANDIDATES_WHY_FIT}\n` +
      `${reasons}\n`;

    if (candidate.qualityLabel === "limited") {
      text += `\n${MATCH_LIMITED_SIMILARITY_NOTE}\n`;
    }

    text += "\n";
  });

  return escapeHtml(text.trim());
};

import type { Context } from "grammy";
import type { Environment } from "../types/runtime.env";
import { getResolvedUser } from "../bot/context";
import { renderScreen } from "../bot/render-screen";
import { formatSuggestionHubMessage } from "../i18n/conversation-suggestions-ui";
import { buildSuggestionHubKeyboard } from "./suggestion-keyboards";
import { buildSuggestionHubView } from "./hub-state.ts";

export const renderSuggestionHub = async (
  ctx: Context,
  env: Environment,
  _telegramUserId: string,
  renderOptions?: { skipAnswer?: boolean }
): Promise<void> => {
  const user = await getResolvedUser(ctx, env);
  const view = await buildSuggestionHubView(env, user.id);

  await renderScreen(
    ctx,
    {
      text: formatSuggestionHubMessage({
        assessmentLine: view.assessmentLine,
        discoverabilityLine: view.discoverabilityLine,
        pendingLine: view.pendingLine,
        eligibilityLine: view.eligibilityLine,
        ...(view.profileSummaryHtml
          ? { profileSummaryHtml: view.profileSummaryHtml }
          : {}),
      }),
      replyMarkup: buildSuggestionHubKeyboard(view.keyboard),
    },
    renderOptions
  );
};

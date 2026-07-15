import { CONVERSATION_DIMENSIONS } from "./constants.ts";
import type { ConversationProfile, ProfileLocale } from "../../../contracts/conversation/profile";
import { convertToPersianNumbers, escapeHtml } from "../../../utils/text.ts";

const INTENT_LABELS_FA: Record<ConversationProfile["currentIntent"], string> = {
  light: "گفت‌وگوی سبک و ساده",
  deep: "گفت‌وگوی عمیق‌تر",
  support: "شنیده‌شدن و همراهی",
  exploration: "کشف موضوع‌های تازه",
  open: "بدون ترجیح مشخص",
};

const INTENT_LABELS_EN: Record<ConversationProfile["currentIntent"], string> = {
  light: "light, low-pressure chat",
  deep: "deeper conversation",
  support: "listening and support",
  exploration: "exploring new topics",
  open: "no strong preference",
};

const DIMENSION_LABELS_FA: Record<(typeof CONVERSATION_DIMENSIONS)[number], string> = {
  depth: "عمق گفت‌وگو",
  replyPace: "ریتم پاسخ",
  directness: "مستقیم‌بودن",
  energy: "انرژی گفت‌وگو",
  playfulness: "سبک و شوخی",
  supportStyle: "همراهی احساسی",
  disclosurePace: "سرعت باز شدن",
  repairStyle: "ترمیم سوءتفاهم",
};

const formatPercent = (value: number): string =>
  `${Math.round(value * 100)}٪`;

const styleLevelFa = (value: number): string => {
  if (value >= 0.7) {
    return "پررنگ";
  }
  if (value >= 0.45) {
    return "متعادل";
  }
  return "آرام‌تر";
};

const desiredLevelFa = (value: number): string => {
  if (value <= 0) {
    return "بدون ترجیح مشخص";
  }
  if (value >= 0.7) {
    return "زیاد";
  }
  if (value >= 0.45) {
    return "متعادل";
  }
  return "کم";
};

const topSelfDimensions = (profile: ConversationProfile, limit: number) =>
  CONVERSATION_DIMENSIONS.map((dimension) => ({
    dimension,
    weight: profile.importance[dimension],
    self: profile.selfStyle[dimension],
  }))
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit);

const topDesiredDimensions = (profile: ConversationProfile, limit: number) =>
  CONVERSATION_DIMENSIONS.map((dimension) => ({
    dimension,
    weight: profile.importance[dimension],
    desired: profile.desiredStyle[dimension],
  }))
    .filter((entry) => entry.weight > 0 && entry.desired > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit);

export const buildProfileSummaryText = (
  profile: ConversationProfile,
  locale: ProfileLocale
): string => {
  const intentLabel =
    locale === "en"
      ? INTENT_LABELS_EN[profile.currentIntent]
      : INTENT_LABELS_FA[profile.currentIntent];

  const topDimensions = topSelfDimensions(profile, 3);

  if (locale === "en") {
    const lines = [`Current openness: ${intentLabel}.`];
    if (topDimensions.length > 0) {
      lines.push(
        "Stronger preferences: " +
          topDimensions
            .map(
              (entry) =>
                `${entry.dimension} (${formatPercent(entry.self)})`
            )
            .join(", ")
      );
    }
    return lines.join("\n");
  }

  const lines = [
    `تمایل فعلی: ${intentLabel}.`,
  ];

  if (topDimensions.length > 0) {
    lines.push(
      "ویژگی‌های پررنگ‌تر: " +
        topDimensions
          .map(
            (entry) =>
              `${DIMENSION_LABELS_FA[entry.dimension]}: ${styleLevelFa(entry.self)}`
          )
          .join("، ")
    );
  }

  return lines.join("\n");
};

export const buildProfileHubSummaryHtml = (
  profile: ConversationProfile,
  locale: ProfileLocale
): string => {
  if (locale === "en") {
    return escapeHtml(buildProfileSummaryText(profile, locale));
  }

  const intentLabel = INTENT_LABELS_FA[profile.currentIntent];
  const selfLines = topSelfDimensions(profile, 4).map(
    (entry) =>
      `• ${escapeHtml(DIMENSION_LABELS_FA[entry.dimension])}: ${escapeHtml(styleLevelFa(entry.self))}`
  );
  const desiredLines = topDesiredDimensions(profile, 4).map(
    (entry) =>
      `• ${escapeHtml(DIMENSION_LABELS_FA[entry.dimension])}: ${escapeHtml(desiredLevelFa(entry.desired))}`
  );
  const noPreferenceCount = CONVERSATION_DIMENSIONS.filter(
    (dimension) => profile.importance[dimension] === 0
  ).length;

  const lines = [
    `<b>تمایل فعلی:</b> ${escapeHtml(intentLabel)}`,
  ];

  if (selfLines.length > 0) {
    lines.push("", "<b>سبک خودت</b>", ...selfLines);
  }

  if (desiredLines.length > 0) {
    lines.push("", "<b>ترجیح برای گزینه‌ی گفت‌وگو</b>", ...desiredLines);
  }

  if (noPreferenceCount > 0) {
    lines.push(
      "",
      `<i>${convertToPersianNumbers(noPreferenceCount)} زمینه رو بدون ترجیح مشخص گذاشتی.</i>`
    );
  }

  return lines.join("\n");
};

import { ASSESSMENT_VERSION } from "./question-bank";
import type { AssessmentResultSummary, AssessmentScores } from "./scoring";

function bucket(score: number): "low" | "medium" | "high" {
  if (score >= 0.67) {
    return "high";
  }
  if (score >= 0.34) {
    return "medium";
  }
  return "low";
}

const replyPacePhrase = (scores: AssessmentScores): string => {
  if (scores.replyPacePreference >= 0.67) {
    return "prefers slower, thoughtful reply pace";
  }
  if (scores.replyPacePreference <= 0.33) {
    return "prefers steady, responsive reply pace";
  }
  return "flexible reply pace";
};

const directnessPhrase = (scores: AssessmentScores): string => {
  if (scores.directnessPreference >= 0.67) {
    return "prefers direct but respectful communication";
  }
  if (scores.directnessPreference <= 0.33) {
    return "prefers indirect, gentle communication";
  }
  return "moderate directness preference";
};

const supportPhrase = (scores: AssessmentScores): string => {
  if (scores.supportPreference >= 0.67) {
    return "needs warm listening before advice";
  }
  if (scores.supportPreference <= 0.33) {
    return "prefers practical solutions over emotional support";
  }
  return "balanced support preference";
};

const anonymityPhrase = (scores: AssessmentScores): string => {
  if (scores.anonymityComfort >= 0.67) {
    return "comfortable with anonymous conversation";
  }
  if (scores.anonymityComfort <= 0.33) {
    return "cautious in anonymous conversation";
  }
  return "moderately comfortable with anonymity";
};

const matchingNotes = (scores: AssessmentScores): string[] => {
  const notes: string[] = [];

  if (scores.boundaryRespect >= 0.55 && scores.warmthEmpathy >= 0.5) {
    notes.push("good for low-pressure, respectful anonymous conversation");
  }

  if (scores.replyPacePreference >= 0.6) {
    notes.push("avoid pushy or very fast message rhythm");
  }

  if (scores.emotionalSensitivity >= 0.65 && scores.warmthEmpathy >= 0.55) {
    notes.push("values warm tone and emotional attunement");
  }

  if (scores.depthPreference >= 0.65) {
    notes.push("enjoys moderately deep conversation");
  }

  if (notes.length === 0) {
    notes.push("open to balanced anonymous conversation styles");
  }

  return notes;
};

const bandFa = (score: number): "پایین" | "میانه" | "بالا" => {
  if (score >= 0.67) {
    return "بالا";
  }
  if (score >= 0.34) {
    return "میانه";
  }
  return "پایین";
};

const describeFa = (key: string, score: number): string =>
  `${key}: ${bandFa(score)}.`;

export const buildProfileEmbeddingText = (
  scores: AssessmentScores,
  summary: AssessmentResultSummary,
  locale: string,
  version: string = ASSESSMENT_VERSION
): string => {
  if (locale !== "en") {
    return [
      `زبان: fa.`,
      `نسخه ارزیابی: ${version}.`,
      "خلاصه سبک گفت‌وگو:",
      describeFa("احترام به مرزها", scores.boundaryRespect),
      describeFa("ترجیح عمق گفتگو", scores.depthPreference),
      describeFa("ریتم پاسخ‌دهی", scores.replyPacePreference),
      describeFa("مستقیم‌بودن محترمانه", scores.directnessPreference),
      describeFa("راحتی با ناشناس‌بودن", scores.anonymityComfort),
      describeFa("تمایل به ترمیم سوءتفاهم", scores.conflictRepair),
      "این کاربر برای شروع گفتگو به سیگنال‌های آرام، محترمانه و ناشناس تکیه می‌کند.",
      summary.title ? `عنوان محصولی: ${summary.title}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = [
    `Language: ${locale}.`,
    `Assessment version: ${version}.`,
    "Conversation profile:",
    `- ${bucket(scores.boundaryRespect)} boundary respect`,
    `- ${bucket(scores.emotionalSensitivity)} emotional sensitivity`,
    `- ${bucket(scores.emotionalRegulation)} emotional regulation`,
    `- ${bucket(scores.curiosityDepth)} curiosity and depth`,
    `- ${replyPacePhrase(scores)}`,
    `- ${directnessPhrase(scores)}`,
    `- ${supportPhrase(scores)}`,
    `- ${anonymityPhrase(scores)}`,
    "Matching notes:",
    ...matchingNotes(scores).map((line) => `- ${line}`),
  ];

  if (summary.title) {
    lines.push(`Profile title: ${summary.title}.`);
  }

  return lines.join("\n");
};

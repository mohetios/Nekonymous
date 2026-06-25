export type MatchQualityLabel = "strong" | "good" | "moderate" | "limited";

export const MATCH_QUALITY_COPY: Record<MatchQualityLabel, string> = {
  strong: "سبک گفت‌وگوی خیلی نزدیک",
  good: "سبک گفت‌وگوی نزدیک",
  moderate: "نزدیکی متوسط در سبک گفت‌وگو",
  limited: "نزدیکی محدود در سبک گفت‌وگو",
};

export const MATCH_LIMITED_SIMILARITY_NOTE =
  "شباهت این پیشنهاد محدود است، اما در حال حاضر یکی از نزدیک‌ترین گزینه‌های موجود است.\n" +
  "اگر خواستی، با یک پیام کوتاه و کم‌فشار شروع کن.";

export const MATCH_SIMILARITY_DISCLAIMER =
  "این نتیجه فقط یک سیگنال محصولی برای شروع گفت‌وگو است، نه سازگاری قطعی.";

export const getMatchQualityLabel = (score: number): MatchQualityLabel => {
  const safe = Number.isFinite(score) ? score : 0;
  if (safe >= 0.75) {
    return "strong";
  }
  if (safe >= 0.6) {
    return "good";
  }
  if (safe >= 0.4) {
    return "moderate";
  }
  return "limited";
};

export const formatMatchRequestSimilarityLine = (
  qualityLabel: MatchQualityLabel
): string => {
  if (qualityLabel === "limited") {
    return (
      "یک نفر از بین گزینه‌های فعلی می‌خواهد با تو یک گفت‌وگوی ناشناس کم‌فشار شروع کند."
    );
  }
  return (
    `یک نفر با ${MATCH_QUALITY_COPY[qualityLabel]} می‌خواهد با تو یک گفت‌وگوی ناشناس شروع کند.`
  );
};

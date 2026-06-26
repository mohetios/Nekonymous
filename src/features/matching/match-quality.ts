export type { MatchQualityLabel } from "../../i18n/matching";
export {
  MATCH_QUALITY_COPY,
  MATCH_LIMITED_SIMILARITY_NOTE,
  MATCH_SIMILARITY_DISCLAIMER,
  formatMatchRequestSimilarityLine,
} from "../../i18n/matching";

export const getMatchQualityLabel = (
  score: number
): import("../../i18n/matching").MatchQualityLabel => {
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

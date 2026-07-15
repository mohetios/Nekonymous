import type { ConversationProfile } from "../types/conversation.profile";
import type { RetrievalChannel } from "../types/conversation.retrieval";

export type RankedCandidate = {
  profileHash: string;
  revision: number;
  profile: ConversationProfile;
  pairTag: string;
  channels: RetrievalChannel[];
  requesterToCandidate: number;
  candidateToRequester: number;
  reciprocalScore: number;
  intentAdjustment: number;
  finalScore: number;
  explanation: string;
};

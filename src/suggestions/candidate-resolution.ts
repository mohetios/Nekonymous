import {
  createVectorLookupHash,
  deriveProfileEncryptionKey,
  deriveVectorRouteKey,
  profileEncAad,
  vectorRouteAad,
} from "../ticketing/conversation-keys.ts";
import { decryptEnvelope } from "../ticketing/envelope.ts";
import type { VectorRouteCapsule } from "../ticketing/conversation-capabilities.ts";
import {
  getProfileRecord,
  getVectorRouteRecord,
} from "../storage/profile-vault.client";
import type { Environment } from "../types/runtime.env";
import type { ConversationProfile, ProfileLocale } from "../types/conversation.profile";
import { RETRIEVAL_MAX_CONCURRENT_VAULT_RESOLVES } from "./suggestion-constants.ts";
import {
  dedupeResolvedHits,
  passesRetrievalFilter,
  roleMatchesChannel,
} from "./retrieval-utils.ts";
import type { CandidateProfile, ResolvedVectorHit, RetrievalChannel, VectorHit } from "../types/conversation.retrieval";
import type { VectorRouteRole } from "../types/conversation.profile-vault";
import { mapBounded } from "../utils/concurrency.ts";

export type ResolveCandidatesInput = {
  requesterProfileHash: string;
  requesterLocale: ProfileLocale;
  vectorHits: VectorHit[];
  expectedRoleForChannel: (channel: RetrievalChannel) => VectorRouteRole;
};

const resolveVectorHit = async (
  env: Environment,
  hit: VectorHit,
  expectedRoleForChannel: (channel: RetrievalChannel) => VectorRouteRole
): Promise<ResolvedVectorHit | null> => {
  const vectorHash = await createVectorLookupHash(
    env.APP_MASTER_KEY,
    hit.vectorizeId
  );
  const record = await getVectorRouteRecord(env, vectorHash);
  if (!record || record.status !== "active") {
    return null;
  }

  if (!roleMatchesChannel(hit.channel, record.role, expectedRoleForChannel)) {
    return null;
  }

  const routeKey = await deriveVectorRouteKey(env.APP_MASTER_KEY, vectorHash);
  const route = await decryptEnvelope<VectorRouteCapsule>(
    routeKey,
    record.vectorRouteEnc,
    vectorRouteAad(vectorHash)
  );

  if (route.vectorizeId !== hit.vectorizeId) {
    return null;
  }
  if (route.revision !== record.revision) {
    return null;
  }

  return {
    vectorizeId: hit.vectorizeId,
    channel: hit.channel,
    profileHash: route.profileHash,
    revision: route.revision,
    role: record.role,
  };
};

const loadCandidateProfile = async (
  env: Environment,
  profileHash: string,
  revision: number,
  channels: RetrievalChannel[],
  requesterProfileHash: string,
  requesterLocale: ProfileLocale
): Promise<CandidateProfile | null> => {
  const record = await getProfileRecord(env, profileHash);
  if (!record) {
    return null;
  }

  const profileKey = await deriveProfileEncryptionKey(
    env.APP_MASTER_KEY,
    profileHash
  );
  const profile = await decryptEnvelope<ConversationProfile>(
    profileKey,
    record.profileEnc,
    profileEncAad(profileHash)
  );

  if (
    !passesRetrievalFilter({
      requesterProfileHash,
      requesterLocale,
      profileHash,
      profileStatus: record.status,
      profileRevision: record.revision,
      routeRevision: revision,
      routeStatus: "active",
      profileLocale: profile.locale,
    })
  ) {
    return null;
  }

  return {
    profileHash,
    revision: record.revision,
    profile,
    channels,
  };
};

export const resolveCandidateProfiles = async (
  env: Environment,
  input: ResolveCandidatesInput
): Promise<CandidateProfile[]> => {
  if (input.vectorHits.length === 0) {
    return [];
  }

  const resolvedHits = (
    await mapBounded(
      input.vectorHits,
      RETRIEVAL_MAX_CONCURRENT_VAULT_RESOLVES,
      (hit) => resolveVectorHit(env, hit, input.expectedRoleForChannel)
    )
  ).filter((hit): hit is ResolvedVectorHit => hit !== null);

  const dedupedProfiles = dedupeResolvedHits(resolvedHits);

  const profileEntries = [...dedupedProfiles.entries()];
  const candidates = (
    await mapBounded(
      profileEntries,
      RETRIEVAL_MAX_CONCURRENT_VAULT_RESOLVES,
      async ([profileHash, meta]) =>
        loadCandidateProfile(
          env,
          profileHash,
          meta.revision,
          meta.channels,
          input.requesterProfileHash,
          input.requesterLocale
        )
    )
  ).filter((candidate): candidate is CandidateProfile => candidate !== null);

  return candidates.sort((left, right) =>
    left.profileHash.localeCompare(right.profileHash)
  );
};

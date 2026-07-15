import type { ProfileVaultRecordStatus } from "../../../contracts/conversation/profile-vault.ts";
import type { ProfileRouteCapsule } from "../../ticketing/conversation-capabilities.ts";

const SEARCH_READY_STATUSES = new Set<ProfileVaultRecordStatus>([
  "private",
  "discoverable",
]);

export const profileRouteHasIndexVectors = (
  route: ProfileRouteCapsule | null
): boolean => !!route?.selfVectorizeId && !!route?.desiredVectorizeId;

export const profileStatusAllowsSearch = (
  status: ProfileVaultRecordStatus
): boolean => SEARCH_READY_STATUSES.has(status);

export const profileRouteIsSearchReady = (
  status: ProfileVaultRecordStatus,
  route: ProfileRouteCapsule | null
): boolean => profileStatusAllowsSearch(status) && profileRouteHasIndexVectors(route);

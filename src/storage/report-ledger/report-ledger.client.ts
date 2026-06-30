import type { Environment } from "../../types";
import type {
  ReportLedgerEvent,
  ReportLedgerResult,
} from "./report-ledger.types";

const shardName = (tag: string): string => tag.slice(0, 8);

const stub = (env: Environment, tag: string) =>
  env.REPORT_LEDGER.get(env.REPORT_LEDGER.idFromName(shardName(tag)));

const doFetch = async <T>(
  env: Environment,
  tag: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await stub(env, tag).fetch(
    `https://report-ledger${path}`,
    init
  );
  if (!response.ok) {
    throw new Error(`ReportLedgerDO ${path} failed: ${response.status}`);
  }
  return response.json<T>();
};

export const recordReportEvent = async (
  env: Environment,
  event: ReportLedgerEvent
): Promise<ReportLedgerResult> =>
  doFetch<ReportLedgerResult>(env, event.pairAbuseTag ?? event.senderAbuseTag, "/reports", {
    method: "POST",
    body: JSON.stringify(event),
  });

export const hasReportForPairTag = async (
  env: Environment,
  pairAbuseTag: string
): Promise<boolean> => {
  const body = await doFetch<{ found: boolean }>(
    env,
    pairAbuseTag,
    `/pair/${encodeURIComponent(pairAbuseTag)}`
  );
  return body.found;
};

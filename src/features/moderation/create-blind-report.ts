import type { Environment } from "../../contracts/runtime";
import { submitReport } from "../../storage/safety-state/safety-state.client";
import type { RouteCapsule } from "../../contracts/ticketing/model";
import type { ReportReasonCode } from "../../contracts/safety/model";
import {
  createReporterSubjectTag,
  createReportEventTag,
} from "../ticketing/blind-tags";

const REPORT_REASON_CODES = new Set<ReportReasonCode>([
  "inbox_report",
  "spam",
]);

export type CreateBlindReportInput = {
  actorHash: string;
  ticketHash: string;
  route: RouteCapsule;
  reasonCode: ReportReasonCode;
};

export const createBlindReport = async (
  env: Environment,
  input: CreateBlindReportInput
): Promise<{ reportId: string; duplicate: boolean }> => {
  if (!REPORT_REASON_CODES.has(input.reasonCode)) {
    throw new Error("Invalid report reason code");
  }
  const [eventTag, reporterSubjectTag] = await Promise.all([
    createReportEventTag(
      env.APP_HMAC_PEPPER,
      input.ticketHash,
      input.actorHash
    ),
    createReporterSubjectTag(
      env.APP_HMAC_PEPPER,
      input.route.abuseSubjectTag,
      input.actorHash
    ),
  ]);
  const result = await submitReport(env, input.route.abuseSubjectTag, {
    eventTag,
    reporterSubjectTag,
    reasonCode: input.reasonCode,
  });

  return {
    reportId: eventTag,
    duplicate: result.duplicate,
  };
};

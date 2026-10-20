// Business rules, kept free of the database so they can be unit tested.
import type { PaymentKind, PaymentStatus, SampleStatus, Stage } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;

// Stages where the brand has committed money to the creator.
export const COMMITTED_STAGES: Stage[] = [
  "APPROVED",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
  "SAMPLE_SHIPPED",
  "POSTING",
  "COMPLETED",
];

export const OPEN_STAGES: Stage[] = ["PROSPECT", "CLIENT_REVIEW", ...COMMITTED_STAGES.filter((s) => s !== "COMPLETED")];

export function splitFee(flatFee: number, upfrontPercent: number) {
  const pct = Math.min(100, Math.max(0, upfrontPercent));
  const upfront = Math.round(flatFee * pct) / 100;
  return { upfront, final: Math.round((flatFee - upfront) * 100) / 100 };
}

export type PaymentLite = { kind: PaymentKind; amount: number; status: PaymentStatus };
export type VideoLite = { disqualified: boolean; sparkCode?: string | null; views?: number | null; gmv?: number | null; angle?: string | null };

export type RetainerLite = {
  id: string;
  stage: Stage;
  stageChangedAt: Date;
  sampleStatus: SampleStatus;
  flatFee: number;
  videosRequired: number;
  startDate: Date;
  dueDate: Date | null;
  payments: PaymentLite[];
  videos: VideoLite[];
};

export function deliveredCount(videos: VideoLite[]) {
  return videos.filter((v) => !v.disqualified).length;
}

export function paidTotal(payments: PaymentLite[]) {
  return payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
}

// Money tied up in a retainer: the full fee once committed; what was actually paid if stopped early.
export function allocatedAmount(r: Pick<RetainerLite, "stage" | "flatFee" | "payments">) {
  if (COMMITTED_STAGES.includes(r.stage)) return r.flatFee;
  if (r.stage === "STOPPED") return paidTotal(r.payments);
  return 0;
}

export function budgetSummary(monthlyBudget: number, retainers: RetainerLite[]) {
  const counted = retainers.filter((r) => COMMITTED_STAGES.includes(r.stage) || r.stage === "STOPPED");
  const allocated = counted.reduce((sum, r) => sum + allocatedAmount(r), 0);
  const paid = counted.reduce((sum, r) => sum + paidTotal(r.payments), 0);
  return {
    budget: monthlyBudget,
    allocated,
    paid,
    remaining: monthlyBudget - allocated,
    usage: monthlyBudget > 0 ? allocated / monthlyBudget : null,
    videosDelivered: counted.reduce((sum, r) => sum + deliveredCount(r.videos), 0),
    videosRequired: counted.reduce((sum, r) => sum + r.videosRequired, 0),
    creators: counted.length,
  };
}

export type Pace = "done" | "on_track" | "behind" | "overdue" | "not_started";

// Compares delivered videos against a straight line from start date to due date.
export function pace(r: RetainerLite, now: Date): Pace {
  const delivered = deliveredCount(r.videos);
  if (r.videosRequired > 0 && delivered >= r.videosRequired) return "done";
  if (r.stage !== "POSTING") return "not_started";
  if (!r.dueDate) return "on_track";
  if (now > r.dueDate) return "overdue";
  const total = r.dueDate.getTime() - r.startDate.getTime();
  if (total <= 0) return "on_track";
  const expected = Math.floor((r.videosRequired * (now.getTime() - r.startDate.getTime())) / total);
  return delivered < expected ? "behind" : "on_track";
}

export type QueueItem = { retainerId: string; action: string; urgency: "high" | "normal" };

const STALE_DAYS = 3;

// Everything blocked on the team, one entry per retainer per action.
export function queueFor(r: RetainerLite, opts: { hasPayoutDetails: boolean; now: Date }): QueueItem[] {
  const items: QueueItem[] = [];
  const add = (action: string, urgency: QueueItem["urgency"] = "normal") => items.push({ retainerId: r.id, action, urgency });
  const daysInStage = (opts.now.getTime() - r.stageChangedAt.getTime()) / DAY;
  const upfront = r.payments.find((p) => p.kind === "UPFRONT");
  const final = r.payments.find((p) => p.kind === "FINAL");
  const delivered = deliveredCount(r.videos);
  const signedOrLater: Stage[] = ["CONTRACT_SIGNED", "SAMPLE_SHIPPED", "POSTING", "COMPLETED"];

  if (r.stage === "CLIENT_REVIEW" && daysInStage > STALE_DAYS) add(`Chase client for a decision (${Math.floor(daysInStage)} days waiting)`);
  if (r.stage === "APPROVED") add("Send contract");
  if (r.stage === "CONTRACT_SENT" && daysInStage > STALE_DAYS) add("Follow up on unsigned contract");

  if (signedOrLater.includes(r.stage)) {
    if (!opts.hasPayoutDetails) add("Collect creator's PayPal / Zelle details", "high");
    if (upfront && upfront.status === "PENDING" && opts.hasPayoutDetails) add("Share upfront payment details with client", "high");
    if (upfront && upfront.status === "DETAILS_SHARED") add("Confirm upfront was paid by client");
    if (upfront && upfront.status === "ON_HOLD") add("Upfront payment on hold", "high");
    if (r.sampleStatus === "NOT_SENT") add("Ship sample");
  }

  if (r.stage === "POSTING") {
    const p = pace(r, opts.now);
    if (p === "overdue") add(`Overdue: ${delivered}/${r.videosRequired} videos`, "high");
    if (p === "behind") add(`Behind pace: ${delivered}/${r.videosRequired} videos`);
    const missingCodes = r.videos.filter((v) => !v.disqualified && !v.sparkCode).length;
    if (missingCodes > 0) add(`Get Spark code for ${missingCodes} video${missingCodes > 1 ? "s" : ""}`);
  }

  if (r.videosRequired > 0 && delivered >= r.videosRequired && (r.stage === "POSTING" || r.stage === "COMPLETED")) {
    if (final && (final.status === "PENDING" || final.status === "DETAILS_SHARED")) add("All videos delivered: arrange final payment", "high");
    if (r.stage === "POSTING") add("Mark collab completed");
  }

  return items;
}

export function angleReport(videos: VideoLite[]) {
  const groups = new Map<string, { angle: string; videos: number; views: number; gmv: number }>();
  for (const v of videos) {
    if (v.disqualified) continue;
    const angle = v.angle?.trim() || "Untagged";
    const g = groups.get(angle) ?? { angle, videos: 0, views: 0, gmv: 0 };
    g.videos += 1;
    g.views += v.views ?? 0;
    g.gmv += v.gmv ?? 0;
    groups.set(angle, g);
  }
  return [...groups.values()].sort((a, b) => b.gmv - a.gmv || b.views - a.views);
}

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(key: string) {
  const [y, m] = key.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

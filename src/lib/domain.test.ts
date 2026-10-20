import { describe, expect, it } from "vitest";
import { angleReport, budgetSummary, pace, queueFor, splitFee, type RetainerLite } from "./domain";

const day = 86_400_000;
const now = new Date("2026-10-20T12:00:00Z");

function retainer(over: Partial<RetainerLite> = {}): RetainerLite {
  return {
    id: "r1",
    stage: "POSTING",
    stageChangedAt: new Date(now.getTime() - day),
    sampleStatus: "DELIVERED",
    flatFee: 400,
    videosRequired: 10,
    startDate: new Date(now.getTime() - 10 * day),
    dueDate: new Date(now.getTime() + 10 * day),
    payments: [
      { kind: "UPFRONT", amount: 200, status: "PAID" },
      { kind: "FINAL", amount: 200, status: "PENDING" },
    ],
    videos: [],
    ...over,
  };
}

const videos = (n: number, extra = {}) => Array.from({ length: n }, () => ({ disqualified: false, sparkCode: "#code", ...extra }));

describe("splitFee", () => {
  it("splits by upfront percent", () => {
    expect(splitFee(450, 50)).toEqual({ upfront: 225, final: 225 });
    expect(splitFee(375, 50)).toEqual({ upfront: 187.5, final: 187.5 });
    expect(splitFee(500, 100)).toEqual({ upfront: 500, final: 0 });
    expect(splitFee(500, 0)).toEqual({ upfront: 0, final: 500 });
  });
});

describe("budgetSummary", () => {
  it("counts committed fees, actual spend on stopped collabs, and ignores prospects", () => {
    const s = budgetSummary(1000, [
      retainer({ flatFee: 600, videos: videos(4) }),
      retainer({ stage: "CLIENT_REVIEW", flatFee: 900 }),
      retainer({ stage: "STOPPED", flatFee: 500, payments: [{ kind: "UPFRONT", amount: 250, status: "PAID" }] }),
    ]);
    expect(s.allocated).toBe(850);
    expect(s.paid).toBe(450);
    expect(s.remaining).toBe(150);
    expect(s.creators).toBe(2);
    expect(s.videosDelivered).toBe(4);
  });

  it("goes negative when over budget", () => {
    const s = budgetSummary(500, [retainer({ flatFee: 600 })]);
    expect(s.remaining).toBe(-100);
    expect(s.usage).toBeCloseTo(1.2);
  });
});

describe("pace", () => {
  it("flags behind, overdue and done", () => {
    expect(pace(retainer({ videos: videos(2) }), now)).toBe("behind"); // halfway, expected 5
    expect(pace(retainer({ videos: videos(5) }), now)).toBe("on_track");
    expect(pace(retainer({ videos: videos(10) }), now)).toBe("done");
    expect(pace(retainer({ dueDate: new Date(now.getTime() - day), videos: videos(3) }), now)).toBe("overdue");
  });

  it("does not count disqualified videos", () => {
    expect(pace(retainer({ videos: videos(10, { disqualified: true }) }), now)).toBe("behind");
  });
});

describe("queueFor", () => {
  const actions = (r: RetainerLite, hasPayoutDetails = true) => queueFor(r, { hasPayoutDetails, now }).map((i) => i.action);

  it("asks for payout details and the sample after the contract is signed", () => {
    const r = retainer({ stage: "CONTRACT_SIGNED", sampleStatus: "NOT_SENT", payments: [{ kind: "UPFRONT", amount: 200, status: "PENDING" }] });
    expect(actions(r, false)).toEqual(["Collect creator's PayPal / Zelle details", "Ship sample"]);
    expect(actions(r, true)).toEqual(["Share upfront payment details with client", "Ship sample"]);
  });

  it("prompts the final payment once every video is in", () => {
    expect(actions(retainer({ videos: videos(10) }))).toEqual(["All videos delivered: arrange final payment", "Mark collab completed"]);
  });

  it("asks for missing Spark codes", () => {
    expect(actions(retainer({ videos: [...videos(5), { disqualified: false, sparkCode: null }] }))).toContain("Get Spark code for 1 video");
  });

  it("only chases client review after a few days", () => {
    expect(actions(retainer({ stage: "CLIENT_REVIEW" }))).toEqual([]);
    expect(actions(retainer({ stage: "CLIENT_REVIEW", stageChangedAt: new Date(now.getTime() - 5 * day) }))[0]).toMatch(/Chase client/);
  });
});

describe("angleReport", () => {
  it("groups by angle and ranks by GMV", () => {
    const report = angleReport([
      { disqualified: false, angle: "Hook A", views: 100, gmv: 10 },
      { disqualified: false, angle: "Hook B", views: 50, gmv: 40 },
      { disqualified: false, angle: "Hook A", views: 100, gmv: 10 },
      { disqualified: true, angle: "Hook B", views: 999, gmv: 999 },
    ]);
    expect(report.map((a) => [a.angle, a.videos, a.gmv])).toEqual([
      ["Hook B", 1, 40],
      ["Hook A", 2, 20],
    ]);
  });
});

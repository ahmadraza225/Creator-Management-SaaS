import Link from "next/link";
import { CreatorLink, Empty, PageHeader, Stat, StageBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { COMMITTED_STAGES, OPEN_STAGES, deliveredCount, queueFor } from "@/lib/domain";
import { usd } from "@/lib/format";
import { retainerWithAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function WaitingOnYou() {
  const now = new Date();
  const retainers = await db.retainer.findMany({
    where: { stage: { in: [...OPEN_STAGES, "COMPLETED"] }, brand: { active: true } },
    include: retainerWithAll,
    orderBy: { stageChangedAt: "asc" },
  });

  const items = retainers
    .flatMap((r) => queueFor(r, { hasPayoutDetails: Boolean(r.creator.payoutDetails), now }).map((item) => ({ ...item, r })))
    .sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === "high" ? -1 : 1));

  const committed = retainers.filter((r) => COMMITTED_STAGES.includes(r.stage));
  const outstanding = committed
    .flatMap((r) => r.payments)
    .filter((p) => p.status !== "PAID" && p.status !== "CANCELLED")
    .reduce((sum, p) => sum + p.amount, 0);
  const posting = retainers.filter((r) => r.stage === "POSTING");

  return (
    <>
      <PageHeader title="Waiting on you" subtitle="Everything blocked on the team, most urgent first" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open actions" value={items.length} tone={items.some((i) => i.urgency === "high") ? "bad" : undefined} />
        <Stat label="In client review" value={retainers.filter((r) => r.stage === "CLIENT_REVIEW").length} />
        <Stat label="Creators posting" value={`${posting.length} · ${posting.reduce((s, r) => s + deliveredCount(r.videos), 0)} videos`} />
        <Stat label="Unpaid creator money" value={usd(outstanding)} />
      </div>

      {items.length === 0 ? (
        <Empty>Nothing waiting. Nice.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Creator</th>
                <th>Brand</th>
                <th>Stage</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(({ action, urgency, r }) => (
                <tr key={`${r.id}-${action}`}>
                  <td className={urgency === "high" ? "font-medium text-red-700" : ""}>
                    {urgency === "high" && <span className="mr-1">●</span>}
                    {action}
                  </td>
                  <td>
                    <CreatorLink handle={r.creator.handle} id={r.creator.id} />
                  </td>
                  <td>
                    <Link href={`/brands/${r.brand.id}`} className="link">
                      {r.brand.name}
                    </Link>
                  </td>
                  <td>
                    <StageBadge stage={r.stage} />
                  </td>
                  <td className="text-right">
                    <Link href={`/retainers/${r.id}`} className="btn-secondary">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

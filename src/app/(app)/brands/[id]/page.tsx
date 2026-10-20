import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBrand } from "@/app/actions";
import { BrandForm } from "@/components/brand-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CreatorLink, Empty, PageHeader, PaceLabel, PaymentBadge, Stat, StageBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { angleReport, budgetSummary, deliveredCount, monthKey, monthRange, pace } from "@/lib/domain";
import { compact, pct, shortDate, usd } from "@/lib/format";
import { retainerWithAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = await db.brand.findUnique({
    where: { id },
    include: { retainers: { include: retainerWithAll, orderBy: { startDate: "desc" } } },
  });
  if (!brand) notFound();

  const now = new Date();
  const { start, end } = monthRange(monthKey(now));
  const thisMonth = budgetSummary(
    brand.monthlyBudget,
    brand.retainers.filter((r) => r.startDate >= start && r.startDate < end),
  );
  const allVideos = brand.retainers.flatMap((r) => r.videos);
  const angles = angleReport(allVideos);
  const sparkCodes = brand.retainers
    .filter((r) => r.stage !== "DECLINED")
    .flatMap((r) => r.videos.filter((v) => v.sparkCode && !v.disqualified).map((v) => `${r.creator.handle}\t${v.sparkCode}\t${v.url}`));

  return (
    <>
      <PageHeader
        title={brand.name}
        subtitle={<Link href="/brands" className="link">← All brands</Link>}
        actions={
          <Link className="btn" href={`/retainers/new?brandId=${brand.id}`}>
            + Add creator retainer
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Budget / month" value={usd(thisMonth.budget)} />
        <Stat label="Allocated this month" value={usd(thisMonth.allocated)} />
        <Stat label="Paid this month" value={usd(thisMonth.paid)} tone="good" />
        <Stat label="Remaining" value={usd(thisMonth.remaining)} tone={thisMonth.remaining < 0 ? "bad" : undefined} />
        <Stat label="Usage" value={pct(thisMonth.usage)} tone={(thisMonth.usage ?? 0) > 1 ? "bad" : undefined} />
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Creator retainers (all months)</h2>
      {brand.retainers.length === 0 ? (
        <Empty>No creators yet for this brand.</Empty>
      ) : (
        <div className="card mb-8 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Stage</th>
                <th>Deal</th>
                <th>Videos</th>
                <th>Upfront</th>
                <th>Final</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {brand.retainers.map((r) => {
                const upfront = r.payments.find((p) => p.kind === "UPFRONT");
                const final = r.payments.find((p) => p.kind === "FINAL");
                return (
                  <tr key={r.id}>
                    <td>
                      <CreatorLink handle={r.creator.handle} id={r.creator.id} />
                    </td>
                    <td>
                      <StageBadge stage={r.stage} />
                    </td>
                    <td className="whitespace-nowrap">
                      {usd(r.flatFee)} for {r.videosRequired}
                    </td>
                    <td className="whitespace-nowrap">
                      {deliveredCount(r.videos)} / {r.videosRequired} <PaceLabel pace={pace(r, now)} />
                    </td>
                    <td>{upfront ? <PaymentBadge status={upfront.status} /> : "–"}</td>
                    <td>{final ? <PaymentBadge status={final.status} /> : "–"}</td>
                    <td className="whitespace-nowrap">{shortDate(r.startDate)}</td>
                    <td className="text-right">
                      <Link href={`/retainers/${r.id}`} className="btn-secondary">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Angle performance</h2>
          {angles.length === 0 ? (
            <Empty>Tag videos with an angle to compare them here.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Angle</th>
                    <th>Videos</th>
                    <th>Views</th>
                    <th>GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {angles.map((a, i) => (
                    <tr key={a.angle}>
                      <td>
                        {a.angle}
                        {i === 0 && a.angle !== "Untagged" && (a.gmv > 0 || a.views > 0) && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Leading</span>
                        )}
                      </td>
                      <td>{a.videos}</td>
                      <td>{compact(a.views)}</td>
                      <td>{usd(a.gmv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Spark codes ({sparkCodes.length})</h2>
          <textarea
            readOnly
            className="input h-48 font-mono text-xs"
            value={sparkCodes.length ? `creator\tspark code\tvideo\n${sparkCodes.join("\n")}` : "No Spark codes yet."}
          />
          <p className="mt-1 text-xs text-slate-500">Select all and paste into a sheet or your GMV Max setup.</p>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Brand details</h2>
      <div className="card mb-4 p-5">
        <BrandForm brand={brand} />
      </div>
      <form action={deleteBrand}>
        <input type="hidden" name="id" value={brand.id} />
        <ConfirmButton message={`Delete ${brand.name} and all of its retainers, videos and payments?`}>Delete brand and all its retainers</ConfirmButton>
      </form>
    </>
  );
}

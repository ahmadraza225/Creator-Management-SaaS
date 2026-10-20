import Link from "next/link";
import type { Prisma, Stage } from "@prisma/client";
import { CreatorLink, Empty, PageHeader, PaceLabel, PaymentBadge, StageBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { OPEN_STAGES, deliveredCount, pace } from "@/lib/domain";
import { shortDate, usd } from "@/lib/format";
import { STAGE_LABEL, STAGES } from "@/lib/labels";
import { retainerWithAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RetainersPage({ searchParams }: { searchParams: Promise<{ brand?: string; stage?: string }> }) {
  const { brand, stage } = await searchParams;
  const stageFilter: Prisma.RetainerWhereInput["stage"] =
    stage && STAGES.includes(stage as Stage) ? (stage as Stage) : stage === "all" ? undefined : { in: [...OPEN_STAGES, "COMPLETED"] };

  const [brands, retainers] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.retainer.findMany({
      where: { stage: stageFilter, brandId: brand || undefined },
      include: retainerWithAll,
      orderBy: [{ brand: { name: "asc" } }, { startDate: "desc" }],
    }),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Retainers"
        subtitle={`${retainers.length} shown`}
        actions={
          <Link className="btn" href="/retainers/new">
            + New retainer
          </Link>
        }
      />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Brand</label>
          <select className="input" name="brand" defaultValue={brand ?? ""}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Stage</label>
          <select className="input" name="stage" defaultValue={stage ?? ""}>
            <option value="">Open + completed</option>
            <option value="all">Everything</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>

      {retainers.length === 0 ? (
        <Empty>No retainers match.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Brand</th>
                <th>Stage</th>
                <th>Deal</th>
                <th>Videos</th>
                <th>Upfront</th>
                <th>Final</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {retainers.map((r) => {
                const upfront = r.payments.find((p) => p.kind === "UPFRONT");
                const final = r.payments.find((p) => p.kind === "FINAL");
                return (
                  <tr key={r.id}>
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
                    <td className="whitespace-nowrap">
                      {usd(r.flatFee)} / {r.videosRequired}
                    </td>
                    <td className="whitespace-nowrap">
                      {deliveredCount(r.videos)} / {r.videosRequired} <PaceLabel pace={pace(r, now)} />
                    </td>
                    <td>{upfront ? <PaymentBadge status={upfront.status} /> : "–"}</td>
                    <td>{final ? <PaymentBadge status={final.status} /> : "–"}</td>
                    <td className="whitespace-nowrap">{shortDate(r.dueDate)}</td>
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
    </>
  );
}

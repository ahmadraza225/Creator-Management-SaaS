import Link from "next/link";
import { CreatorLink, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { COMMITTED_STAGES, deliveredCount } from "@/lib/domain";
import { usd } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const creators = await db.creator.findMany({
    where: q ? { handle: { contains: q.replace(/^@/, "").toLowerCase() } } : {},
    include: { retainers: { include: { brand: true, videos: true } } },
    orderBy: { handle: "asc" },
  });

  return (
    <>
      <PageHeader title="Creators" subtitle={`${creators.length} creators`} />
      <form className="mb-4 flex gap-2">
        <input className="input max-w-xs" name="q" defaultValue={q} placeholder="Search handle" />
        <button className="btn-secondary">Search</button>
      </form>
      {creators.length === 0 ? (
        <Empty>No creators yet. They are added when you create a retainer.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Brands</th>
                <th>Committed fees</th>
                <th>Videos delivered</th>
                <th>Payout</th>
                <th>Followers · GMV</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => {
                const committed = c.retainers.filter((r) => COMMITTED_STAGES.includes(r.stage));
                return (
                  <tr key={c.id}>
                    <td>
                      <CreatorLink handle={c.handle} id={c.id} />
                    </td>
                    <td>
                      {c.retainers.map((r, i) => (
                        <span key={r.id}>
                          {i > 0 && ", "}
                          <Link href={`/retainers/${r.id}`} className="link">
                            {r.brand.name}
                          </Link>
                        </span>
                      ))}
                    </td>
                    <td>{usd(committed.reduce((s, r) => s + r.flatFee, 0))}</td>
                    <td>{c.retainers.reduce((s, r) => s + deliveredCount(r.videos), 0)}</td>
                    <td>{c.payoutMethod ? PAYMENT_METHOD_LABEL[c.payoutMethod] : c.payoutDetails ? "Set" : <span className="text-red-600">Missing</span>}</td>
                    <td className="text-xs text-slate-500">{[c.followers, c.gmvNote].filter(Boolean).join(" · ") || "–"}</td>
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

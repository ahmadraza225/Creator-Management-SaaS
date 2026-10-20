import Link from "next/link";
import { Empty, PageHeader, Progress, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { budgetSummary, monthKey, monthRange } from "@/lib/domain";
import { pct, usd } from "@/lib/format";
import { retainerWithAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

function shiftMonth(key: string, by: number) {
  const { start } = monthRange(key);
  return monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + by, 1)));
}

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : monthKey(new Date());
  const range = monthRange(month);

  const brands = await db.brand.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { retainers: { where: { startDate: { gte: range.start, lt: range.end } }, include: retainerWithAll } },
  });

  const rows = brands.map((b) => ({ brand: b, s: budgetSummary(b.monthlyBudget, b.retainers) }));
  const active = rows.filter((r) => r.brand.active);
  const total = (key: "budget" | "allocated" | "paid" | "remaining") => active.reduce((sum, r) => sum + r.s[key], 0);
  const label = range.start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title="Brands & budgets"
        subtitle={`${active.length} active brands · ${label} · retainers count toward the month they start`}
        actions={
          <>
            <Link className="btn-secondary" href={`/brands?month=${shiftMonth(month, -1)}`} aria-label="Previous month">
              ←
            </Link>
            <span className="btn-secondary pointer-events-none">{label}</span>
            <Link className="btn-secondary" href={`/brands?month=${shiftMonth(month, 1)}`} aria-label="Next month">
              →
            </Link>
            {month !== monthKey(new Date()) && (
              <Link className="btn-secondary" href="/brands">
                This month
              </Link>
            )}
            <Link className="btn" href="/brands/new">
              + New brand
            </Link>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total budget" value={usd(total("budget"))} />
        <Stat label="Allocated" value={usd(total("allocated"))} />
        <Stat label="Paid" value={usd(total("paid"))} tone="good" />
        <Stat label="Remaining" value={usd(total("remaining"))} tone={total("remaining") < 0 ? "bad" : undefined} />
        <Stat
          label="Videos delivered"
          value={`${active.reduce((s, r) => s + r.s.videosDelivered, 0)} / ${active.reduce((s, r) => s + r.s.videosRequired, 0)}`}
        />
      </div>

      {rows.length === 0 ? (
        <Empty>
          No brands yet. <Link href="/brands/new" className="link">Add your first brand</Link>.
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Budget</th>
                <th>Allocated</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th className="w-32">Usage</th>
                <th className="w-32">Videos</th>
                <th>Creators</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ brand, s }) => (
                <tr key={brand.id} className={brand.active ? "" : "opacity-50"}>
                  <td>
                    <Link href={`/brands/${brand.id}`} className="link">
                      {brand.name}
                    </Link>
                    <div className="text-xs text-slate-500">{brand.priority.toLowerCase()} priority{brand.active ? "" : " · inactive"}</div>
                  </td>
                  <td>{usd(s.budget)}</td>
                  <td>{usd(s.allocated)}</td>
                  <td className="text-emerald-700">{usd(s.paid)}</td>
                  <td className={s.remaining < 0 ? "font-medium text-red-600" : ""}>{usd(s.remaining)}</td>
                  <td>
                    <div className="mb-1 text-xs">{pct(s.usage)}</div>
                    <Progress value={s.allocated} max={s.budget} budget />
                  </td>
                  <td>
                    <div className="mb-1 text-xs">
                      {s.videosDelivered} / {s.videosRequired}
                    </div>
                    <Progress value={s.videosDelivered} max={s.videosRequired} />
                  </td>
                  <td>{s.creators}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

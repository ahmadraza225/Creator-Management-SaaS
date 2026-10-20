import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { savePayment } from "@/app/actions";
import { CreatorLink, Empty, PageHeader, Stat } from "@/components/ui";
import { db } from "@/lib/db";
import { inputDate, usd } from "@/lib/format";
import { PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

const STATUSES = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; brand?: string }> }) {
  const { status, brand } = await searchParams;
  const statusFilter: Prisma.PaymentWhereInput["status"] =
    status && STATUSES.includes(status as PaymentStatus) ? (status as PaymentStatus) : status === "all" ? undefined : { in: ["PENDING", "DETAILS_SHARED", "ON_HOLD"] };

  // Payments only become real once the client has approved the creator.
  const where: Prisma.PaymentWhereInput = {
    status: statusFilter,
    retainer: { brandId: brand || undefined, stage: { notIn: ["PROSPECT", "CLIENT_REVIEW", "DECLINED"] } },
  };
  const [brands, payments, totals] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.payment.findMany({
      where,
      include: { retainer: { include: { brand: true, creator: true } } },
      orderBy: [{ retainer: { brand: { name: "asc" } } }, { createdAt: "asc" }],
    }),
    db.payment.groupBy({
      by: ["status"],
      where: { retainer: { brandId: brand || undefined, stage: { notIn: ["PROSPECT", "CLIENT_REVIEW", "DECLINED"] } } },
      _sum: { amount: true },
    }),
  ]);
  const sum = (s: PaymentStatus) => totals.find((t) => t.status === s)?._sum.amount ?? 0;
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(brand ? { brand } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Clients pay creators directly by PayPal or Zelle. Record each payment here once the client confirms it."
        actions={
          <a className="btn-secondary" href={`/payments/export${query ? `?${query}` : ""}`}>
            Export CSV
          </a>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending" value={usd(sum("PENDING"))} />
        <Stat label="Details shared with client" value={usd(sum("DETAILS_SHARED"))} />
        <Stat label="On hold" value={usd(sum("ON_HOLD"))} tone={sum("ON_HOLD") > 0 ? "bad" : undefined} />
        <Stat label="Paid" value={usd(sum("PAID"))} tone="good" />
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status ?? ""}>
            <option value="">Not yet paid</option>
            <option value="all">Everything</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
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
        <button className="btn-secondary">Filter</button>
      </form>

      {payments.length === 0 ? (
        <Empty>No payments match.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Brand</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Payout to</th>
                <th className="min-w-[30rem]">Update</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <CreatorLink handle={p.retainer.creator.handle} id={p.retainer.creator.id} />
                  </td>
                  <td>
                    <Link href={`/retainers/${p.retainer.id}`} className="link">
                      {p.retainer.brand.name}
                    </Link>
                  </td>
                  <td>{PAYMENT_KIND_LABEL[p.kind]}</td>
                  <td className="whitespace-nowrap">{usd(p.amount)}</td>
                  <td className="max-w-[14rem] whitespace-pre-wrap font-mono text-xs">{p.retainer.creator.payoutDetails ?? <span className="text-red-600">missing</span>}</td>
                  <td>
                    <form action={savePayment} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="amount" value={p.amount} />
                      <input type="hidden" name="proofUrl" value={p.proofUrl ?? ""} />
                      <input type="hidden" name="notes" value={p.notes ?? ""} />
                      <input type="hidden" name="back" value={`/payments${query ? `?${query}` : ""}`} />
                      <select className="input w-auto" name="status" defaultValue={p.status}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PAYMENT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <select className="input w-auto" name="method" defaultValue={p.method ?? p.retainer.creator.payoutMethod ?? ""}>
                        <option value="">–</option>
                        {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input className="input w-36" name="paidOn" type="date" defaultValue={inputDate(p.paidOn)} />
                      <input className="input w-32" name="reference" placeholder="Txn ID" defaultValue={p.reference ?? ""} />
                      <button className="btn">Save</button>
                    </form>
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

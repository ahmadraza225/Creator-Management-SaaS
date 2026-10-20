import Link from "next/link";
import { notFound } from "next/navigation";
import { saveCreator } from "@/app/actions";
import { ExternalLink, PageHeader, StageBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { deliveredCount } from "@/lib/domain";
import { shortDate, usd } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.creator.findUnique({
    where: { id },
    include: { retainers: { include: { brand: true, videos: true }, orderBy: { startDate: "desc" } } },
  });
  if (!c) notFound();

  return (
    <>
      <PageHeader
        title={`@${c.handle}`}
        subtitle={
          <span>
            <Link href="/creators" className="link">← All creators</Link> · <ExternalLink href={`https://www.tiktok.com/@${c.handle}`}>Open on TikTok</ExternalLink>
          </span>
        }
        actions={
          <Link href="/retainers/new" className="btn">
            + New retainer
          </Link>
        }
      />
      <div className="card mb-6 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Stage</th>
              <th>Deal</th>
              <th>Videos</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {c.retainers.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/retainers/${r.id}`} className="link">
                    {r.brand.name}
                  </Link>
                </td>
                <td>
                  <StageBadge stage={r.stage} />
                </td>
                <td>
                  {usd(r.flatFee)} for {r.videosRequired}
                </td>
                <td>
                  {deliveredCount(r.videos)} / {r.videosRequired}
                </td>
                <td>{shortDate(r.startDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={saveCreator} className="card grid gap-4 p-5 sm:grid-cols-2">
        <input type="hidden" name="id" value={c.id} />
        <div>
          <label className="label">Contact (phone / email)</label>
          <textarea className="input" name="contact" rows={2} defaultValue={c.contact ?? ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div>
            <label className="label">Payout method</label>
            <select className="input" name="payoutMethod" defaultValue={c.payoutMethod ?? ""}>
              <option value="">–</option>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">PayPal email / Zelle number</label>
            <textarea className="input" name="payoutDetails" rows={2} defaultValue={c.payoutDetails ?? ""} />
          </div>
        </div>
        <div>
          <label className="label">Followers</label>
          <input className="input" name="followers" defaultValue={c.followers ?? ""} />
        </div>
        <div>
          <label className="label">GMV</label>
          <input className="input" name="gmvNote" defaultValue={c.gmvNote ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={3} defaultValue={c.notes ?? ""} />
        </div>
        <div>
          <button className="btn">Save creator</button>
        </div>
      </form>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Stage } from "@prisma/client";
import { addPayment, addVideos, deletePayment, deleteRetainer, deleteVideo, savePayment, setStage, updateRetainer, updateVideo } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { RetainerFields } from "@/components/retainer-fields";
import { ExternalLink, PageHeader, PaceLabel, PaymentBadge, Stat, StageBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { deliveredCount, pace, paidTotal, queueFor } from "@/lib/domain";
import { inputDate, usd } from "@/lib/format";
import { PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, SAMPLE_LABEL, STAGE_LABEL } from "@/lib/labels";
import { retainerWithAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  PROSPECT: "CLIENT_REVIEW",
  CLIENT_REVIEW: "APPROVED",
  APPROVED: "CONTRACT_SENT",
  CONTRACT_SENT: "CONTRACT_SIGNED",
  CONTRACT_SIGNED: "SAMPLE_SHIPPED",
  SAMPLE_SHIPPED: "POSTING",
  POSTING: "COMPLETED",
};

function StageButton({ id, stage, label, secondary }: { id: string; stage: Stage; label: string; secondary?: boolean }) {
  return (
    <form action={setStage}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="stage" value={stage} />
      <button className={secondary ? "btn-secondary" : "btn"}>{label}</button>
    </form>
  );
}

export default async function RetainerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.retainer.findUnique({ where: { id }, include: retainerWithAll });
  if (!r) notFound();

  const now = new Date();
  const delivered = deliveredCount(r.videos);
  const paid = paidTotal(r.payments);
  const todo = queueFor(r, { hasPayoutDetails: Boolean(r.creator.payoutDetails), now });
  const next = NEXT_STAGE[r.stage];
  const closed = r.stage === "COMPLETED" || r.stage === "STOPPED" || r.stage === "DECLINED";

  return (
    <>
      <PageHeader
        title={`@${r.creator.handle} × ${r.brand.name}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StageBadge stage={r.stage} />
            <Link href={`/brands/${r.brand.id}`} className="link">
              Brand
            </Link>
            ·
            <Link href={`/creators/${r.creator.id}`} className="link">
              Creator profile
            </Link>
            ·
            <ExternalLink href={`https://www.tiktok.com/@${r.creator.handle}`}>TikTok</ExternalLink>
          </span>
        }
        actions={
          <>
            {next && <StageButton id={r.id} stage={next} label={`Move to: ${STAGE_LABEL[next]}`} />}
            {!closed && r.stage !== "PROSPECT" && r.stage !== "CLIENT_REVIEW" && <StageButton id={r.id} stage="STOPPED" label="Stop collab" secondary />}
            {(r.stage === "PROSPECT" || r.stage === "CLIENT_REVIEW") && <StageButton id={r.id} stage="DECLINED" label="Declined" secondary />}
          </>
        }
      />

      {todo.length > 0 && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Next steps</div>
          <ul className="list-inside list-disc text-sm text-amber-900">
            {todo.map((t) => (
              <li key={t.action}>{t.action}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Flat fee" value={usd(r.flatFee)} />
        <Stat label="Paid so far" value={`${usd(paid)}`} tone={paid >= r.flatFee && r.flatFee > 0 ? "good" : undefined} />
        <Stat
          label="Videos"
          value={
            <span>
              {delivered} / {r.videosRequired} <PaceLabel pace={pace(r, now)} />
            </span>
          }
        />
        <Stat
          label="Commission"
          value={
            r.affiliateCommissionPct === null && r.adsCommissionPct === null
              ? "Not set"
              : `${r.affiliateCommissionPct ?? 0}% base · ${r.adsCommissionPct ?? 0}% ads`
          }
        />
        <Stat label="Sample" value={SAMPLE_LABEL[r.sampleStatus]} />
      </div>

      {/* ---------- Payments ---------- */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments (paid by the client to the creator)</h2>
        <div className="mb-3 text-sm text-slate-600">
          Creator payout: <span className="font-medium">{r.creator.payoutMethod ? PAYMENT_METHOD_LABEL[r.creator.payoutMethod] : "method not set"}</span>
          {" · "}
          {r.creator.payoutDetails ? (
            <span className="whitespace-pre-wrap font-mono text-xs">{r.creator.payoutDetails}</span>
          ) : (
            <Link href={`/creators/${r.creator.id}`} className="link">
              add payout details
            </Link>
          )}
        </div>
        <div className="space-y-3">
          {r.payments.map((p) => (
            <form key={p.id} action={savePayment} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-8">
              <input type="hidden" name="id" value={p.id} />
              <div className="lg:col-span-1">
                <div className="label">{PAYMENT_KIND_LABEL[p.kind]}</div>
                <PaymentBadge status={p.status} />
              </div>
              <div>
                <label className="label">Amount</label>
                <input className="input" name="amount" type="number" min={0} step="0.01" defaultValue={p.amount} />
              </div>
              <div className="lg:col-span-2">
                <label className="label">Status</label>
                <select className="input" name="status" defaultValue={p.status}>
                  {Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" name="method" defaultValue={p.method ?? r.creator.payoutMethod ?? ""}>
                  <option value="">–</option>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Paid on</label>
                <input className="input" name="paidOn" type="date" defaultValue={inputDate(p.paidOn)} />
              </div>
              <div className="lg:col-span-2">
                <label className="label">Transaction ID</label>
                <input className="input" name="reference" defaultValue={p.reference ?? ""} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="label">Proof link (screenshot / receipt)</label>
                <input className="input" name="proofUrl" type="url" defaultValue={p.proofUrl ?? ""} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="label">Notes</label>
                <input className="input" name="notes" defaultValue={p.notes ?? ""} />
              </div>
              <div className="flex items-end gap-2">
                <button className="btn">Save</button>
                {p.proofUrl && <ExternalLink href={p.proofUrl}>proof</ExternalLink>}
              </div>
            </form>
          ))}
          {r.payments
            .filter((p) => p.kind === "BONUS" || p.kind === "OTHER")
            .map((p) => (
              <form key={`del-${p.id}`} action={deletePayment} className="text-right">
                <input type="hidden" name="id" value={p.id} />
                <ConfirmButton message="Delete this extra payment?" className="text-xs text-red-600 hover:underline">
                  Delete {PAYMENT_KIND_LABEL[p.kind].toLowerCase()} payment of {usd(p.amount)}
                </ConfirmButton>
              </form>
            ))}
          <form action={addPayment} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="retainerId" value={r.id} />
            <div>
              <label className="label">Extra payment</label>
              <select className="input" name="kind" defaultValue="BONUS">
                <option value="BONUS">Bonus</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input w-28" name="amount" type="number" min={0.01} step="0.01" required />
            </div>
            <div>
              <label className="label">Note</label>
              <input className="input" name="notes" />
            </div>
            <button className="btn-secondary">Add</button>
          </form>
        </div>
      </section>

      {/* ---------- Videos ---------- */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Videos ({delivered} delivered of {r.videosRequired})
        </h2>
        <form action={addVideos} className="card mb-3 grid gap-3 p-4 lg:grid-cols-4">
          <input type="hidden" name="retainerId" value={r.id} />
          <div className="lg:col-span-2">
            <label className="label">Paste videos, one per line: link then Spark code</label>
            <textarea
              className="input font-mono text-xs"
              name="lines"
              rows={4}
              required
              placeholder={"https://www.tiktok.com/@creator/video/123  #SparkCode...\nhttps://www.tiktok.com/t/abc/"}
            />
          </div>
          <div>
            <label className="label">Angle (optional)</label>
            <input className="input" name="angle" placeholder="e.g. Visual hook" />
            <label className="label mt-3">Posted on</label>
            <input className="input" name="postedOn" type="date" defaultValue={inputDate(now)} />
          </div>
          <div className="flex items-end">
            <button className="btn">Add videos</button>
          </div>
        </form>

        <div className="space-y-2">
          {r.videos.map((v, i) => (
            <div key={v.id} className={`card p-3 ${v.disqualified ? "opacity-60" : ""}`}>
              <form action={updateVideo} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
                <input type="hidden" name="id" value={v.id} />
                <div className="flex items-center gap-2 text-xs text-slate-500 lg:col-span-12">
                  #{i + 1} <ExternalLink href={v.url}>{v.url}</ExternalLink>
                </div>
                <input type="hidden" name="url" value={v.url} />
                <div className="lg:col-span-4">
                  <label className="label">Spark code</label>
                  <input className="input font-mono text-xs" name="sparkCode" defaultValue={v.sparkCode ?? ""} />
                </div>
                <div className="lg:col-span-2">
                  <label className="label">Angle</label>
                  <input className="input" name="angle" defaultValue={v.angle ?? ""} />
                </div>
                <div className="lg:col-span-2">
                  <label className="label">Posted</label>
                  <input className="input" name="postedOn" type="date" defaultValue={inputDate(v.postedOn)} />
                </div>
                <div>
                  <label className="label">Views</label>
                  <input className="input" name="views" type="number" min={0} defaultValue={v.views ?? ""} />
                </div>
                <div>
                  <label className="label">GMV $</label>
                  <input className="input" name="gmv" type="number" min={0} step="0.01" defaultValue={v.gmv ?? ""} />
                </div>
                <div className="flex flex-col justify-end gap-1 lg:col-span-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="disqualified" defaultChecked={v.disqualified} /> Doesn&apos;t count
                  </label>
                  <button className="btn-secondary">Save</button>
                </div>
              </form>
              <form action={deleteVideo} className="mt-1 text-right">
                <input type="hidden" name="id" value={v.id} />
                <ConfirmButton message="Remove this video?" className="text-xs text-red-600 hover:underline">
                  Remove
                </ConfirmButton>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Details ---------- */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Retainer details</h2>
        <form action={updateRetainer} className="card space-y-4 p-5">
          <input type="hidden" name="id" value={r.id} />
          <RetainerFields retainer={r} />
          <p className="text-xs text-slate-500">Changing the fee or upfront % updates unpaid upfront/final amounts (if the upfront is already paid, the final becomes the rest of the fee). Paid amounts never change.</p>
          <button className="btn">Save details</button>
        </form>
      </section>

      <form action={deleteRetainer}>
        <input type="hidden" name="id" value={r.id} />
        <ConfirmButton message="Delete this retainer with its videos and payments?">Delete retainer</ConfirmButton>
      </form>
    </>
  );
}

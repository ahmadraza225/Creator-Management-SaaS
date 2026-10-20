import type { PaymentStatus, Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAYMENT_STATUS_LABEL } from "@/lib/labels";

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const brand = url.searchParams.get("brand");
  const statuses = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];
  const where: Prisma.PaymentWhereInput = {
    status: status && statuses.includes(status as PaymentStatus) ? (status as PaymentStatus) : status === "all" ? undefined : { in: ["PENDING", "DETAILS_SHARED", "ON_HOLD"] },
    retainer: { brandId: brand || undefined, stage: { notIn: ["PROSPECT", "CLIENT_REVIEW", "DECLINED"] } },
  };
  const payments = await db.payment.findMany({
    where,
    include: { retainer: { include: { brand: true, creator: true } } },
    orderBy: [{ retainer: { brand: { name: "asc" } } }, { createdAt: "asc" }],
  });

  const header = ["brand", "creator", "type", "amount_usd", "status", "method", "payout_details", "paid_on", "transaction_id", "proof_url", "notes"];
  const rows = payments.map((p) => [
    p.retainer.brand.name,
    p.retainer.creator.handle,
    p.kind,
    p.amount,
    p.status,
    p.method,
    p.retainer.creator.payoutDetails,
    p.paidOn,
    p.reference,
    p.proofUrl,
    p.notes,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

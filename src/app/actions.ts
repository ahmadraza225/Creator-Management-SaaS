"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { splitFee } from "@/lib/domain";
import { guessPayoutMethod, parseHandle, parseVideoLines } from "@/lib/parse";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

// ---------- form helpers ----------

const text = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const int = z.coerce.number().int().min(0);
const optNumber = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? Number(v) : null))
  .refine((v) => v === null || Number.isFinite(v), "Must be a number");
const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

function fields(form: FormData) {
  return Object.fromEntries(form.entries()) as Record<string, string>;
}

function done(path: string, to?: string) {
  revalidatePath("/", "layout");
  redirect(to ?? path);
}

// ---------- auth ----------

export type LoginState = { error: string; email: string } | null;

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  // Echo the email back so it survives React's form reset after a failed attempt.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Wrong email or password", email };
  const token = await signSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- brands ----------

const brandSchema = z.object({
  id: text,
  name: z.string().trim().min(1, "Brand name is required"),
  monthlyBudget: int,
  retainerProducts: text,
  affiliateProducts: text,
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  clientNotes: text,
  internalNotes: text,
  active: checkbox,
});

export async function saveBrand(form: FormData) {
  await requireSession();
  const { id, ...data } = brandSchema.parse(fields(form));
  const brand = id ? await db.brand.update({ where: { id }, data }) : await db.brand.create({ data });
  done(`/brands/${brand.id}`);
}

export async function deleteBrand(form: FormData) {
  await requireSession();
  await db.brand.delete({ where: { id: String(form.get("id")) } });
  done("/brands");
}

// ---------- creators ----------

const payoutMethod = z
  .enum(["", "PAYPAL", "ZELLE", "VENMO", "BANK", "OTHER"])
  .optional()
  .transform((v) => (v ? v : null));

const creatorSchema = z.object({
  id: z.string(),
  contact: text,
  payoutMethod,
  payoutDetails: text,
  followers: text,
  gmvNote: text,
  notes: text,
});

export async function saveCreator(form: FormData) {
  await requireSession();
  const { id, ...data } = creatorSchema.parse(fields(form));
  await db.creator.update({ where: { id }, data: { ...data, payoutMethod: data.payoutMethod ?? guessPayoutMethod(data.payoutDetails) } });
  done(`/creators/${id}`);
}

// ---------- retainers ----------

const stage = z.enum([
  "PROSPECT",
  "CLIENT_REVIEW",
  "APPROVED",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
  "SAMPLE_SHIPPED",
  "POSTING",
  "COMPLETED",
  "STOPPED",
  "DECLINED",
]);

const retainerFields = {
  flatFee: int,
  videosRequired: int,
  upfrontPercent: int.max(100),
  affiliateCommissionPct: optNumber,
  adsCommissionPct: optNumber,
  stage,
  sampleStatus: z.enum(["NOT_SENT", "SHIPPED", "DELIVERED", "NOT_NEEDED"]),
  angles: text,
  contractUrl: text,
  startDate: optDate,
  dueDate: optDate,
  notes: text,
};

const newRetainerSchema = z.object({
  brandId: z.string().min(1, "Pick a brand"),
  handle: z.string().transform((v, ctx) => {
    const handle = parseHandle(v);
    if (!handle) ctx.addIssue({ code: "custom", message: "Enter a TikTok handle or profile link" });
    return handle ?? "";
  }),
  ...retainerFields,
});

export async function createRetainer(form: FormData) {
  await requireSession();
  const { brandId, handle, startDate, ...data } = newRetainerSchema.parse(fields(form));
  const creator = await db.creator.upsert({ where: { handle }, update: {}, create: { handle } });
  const { upfront, final } = splitFee(data.flatFee, data.upfrontPercent);
  const retainer = await db.retainer.create({
    data: {
      ...data,
      brandId,
      creatorId: creator.id,
      startDate: startDate ?? new Date(),
      payments: {
        create: [
          ...(upfront > 0 ? [{ kind: "UPFRONT" as const, amount: upfront }] : []),
          ...(final > 0 ? [{ kind: "FINAL" as const, amount: final }] : []),
        ],
      },
    },
  });
  done(`/retainers/${retainer.id}`);
}

const updateRetainerSchema = z.object({ id: z.string(), ...retainerFields });

export async function updateRetainer(form: FormData) {
  await requireSession();
  const { id, startDate, ...data } = updateRetainerSchema.parse(fields(form));
  const before = await db.retainer.findUniqueOrThrow({ where: { id }, include: { payments: true } });
  const split = splitFee(data.flatFee, data.upfrontPercent);
  // If the upfront is already paid, the final covers whatever is left of the (new) fee.
  const paidUpfront = before.payments.find((p) => p.kind === "UPFRONT" && p.status === "PAID");
  const upfront = paidUpfront ? paidUpfront.amount : split.upfront;
  const final = paidUpfront ? Math.max(0, Math.round((data.flatFee - paidUpfront.amount) * 100) / 100) : split.final;

  await db.$transaction(async (tx) => {
    await tx.retainer.update({
      where: { id },
      data: {
        ...data,
        startDate: startDate ?? before.startDate,
        stageChangedAt: before.stage !== data.stage ? new Date() : undefined,
      },
    });
    // Keep unpaid upfront/final amounts in line with the fee; never touch money already marked paid.
    for (const [kind, amount] of [["UPFRONT", upfront], ["FINAL", final]] as const) {
      const existing = before.payments.find((p) => p.kind === kind);
      if (existing && existing.status !== "PAID" && existing.amount !== amount) {
        await tx.payment.update({ where: { id: existing.id }, data: { amount } });
      } else if (!existing && amount > 0) {
        await tx.payment.create({ data: { retainerId: id, kind, amount } });
      }
    }
  });
  done(`/retainers/${id}`);
}

export async function setStage(form: FormData) {
  await requireSession();
  const id = String(form.get("id"));
  await db.retainer.update({ where: { id }, data: { stage: stage.parse(form.get("stage")), stageChangedAt: new Date() } });
  done(`/retainers/${id}`, String(form.get("back") || `/retainers/${id}`));
}

export async function deleteRetainer(form: FormData) {
  await requireSession();
  await db.retainer.delete({ where: { id: String(form.get("id")) } });
  done("/retainers");
}

// ---------- videos ----------

export async function addVideos(form: FormData) {
  await requireSession();
  const retainerId = String(form.get("retainerId"));
  const angle = text.parse(form.get("angle") ?? undefined);
  const postedOn = optDate.parse(form.get("postedOn") || undefined);
  const lines = parseVideoLines(String(form.get("lines") ?? ""));
  for (const { url, sparkCode } of lines) {
    await db.video.upsert({
      where: { retainerId_url: { retainerId, url } },
      update: { sparkCode: sparkCode ?? undefined },
      create: { retainerId, url, sparkCode, angle, postedOn },
    });
  }
  done(`/retainers/${retainerId}`);
}

const videoSchema = z.object({
  id: z.string(),
  url: z.string().trim().url(),
  sparkCode: text,
  angle: text,
  postedOn: optDate,
  views: optNumber,
  gmv: optNumber,
  disqualified: checkbox,
});

export async function updateVideo(form: FormData) {
  await requireSession();
  const { id, views, ...data } = videoSchema.parse(fields(form));
  const video = await db.video.update({ where: { id }, data: { ...data, views: views === null ? null : Math.round(views) } });
  done(`/retainers/${video.retainerId}`);
}

export async function deleteVideo(form: FormData) {
  await requireSession();
  const video = await db.video.delete({ where: { id: String(form.get("id")) } });
  done(`/retainers/${video.retainerId}`);
}

// ---------- payments ----------

const paymentSchema = z.object({
  id: z.string(),
  amount: z.coerce.number().min(0),
  status: z.enum(["PENDING", "DETAILS_SHARED", "ON_HOLD", "PAID", "CANCELLED"]),
  method: payoutMethod,
  reference: text,
  proofUrl: text,
  paidOn: optDate,
  notes: text,
});

export async function savePayment(form: FormData) {
  await requireSession();
  const { id, ...data } = paymentSchema.parse(fields(form));
  const paidOn = data.status === "PAID" ? data.paidOn ?? new Date() : data.paidOn;
  const payment = await db.payment.update({ where: { id }, data: { ...data, paidOn } });
  done(`/retainers/${payment.retainerId}`, String(form.get("back") || `/retainers/${payment.retainerId}`));
}

export async function addPayment(form: FormData) {
  await requireSession();
  const retainerId = String(form.get("retainerId"));
  const amount = z.coerce.number().positive().parse(form.get("amount"));
  const kind = z.enum(["BONUS", "OTHER"]).parse(form.get("kind"));
  await db.payment.create({ data: { retainerId, amount, kind, notes: text.parse(form.get("notes") ?? undefined) } });
  done(`/retainers/${retainerId}`);
}

export async function deletePayment(form: FormData) {
  await requireSession();
  const payment = await db.payment.delete({ where: { id: String(form.get("id")) } });
  done(`/retainers/${payment.retainerId}`);
}

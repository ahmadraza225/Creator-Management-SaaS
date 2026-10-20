import Link from "next/link";
import type { PaymentStatus, Stage } from "@prisma/client";
import { PAYMENT_STATUS_LABEL, STAGE_LABEL } from "@/lib/labels";
import type { Pace } from "@/lib/domain";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

const STAGE_COLOR: Record<Stage, string> = {
  PROSPECT: "bg-slate-100 text-slate-700",
  CLIENT_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-sky-100 text-sky-800",
  CONTRACT_SENT: "bg-sky-100 text-sky-800",
  CONTRACT_SIGNED: "bg-indigo-100 text-indigo-800",
  SAMPLE_SHIPPED: "bg-indigo-100 text-indigo-800",
  POSTING: "bg-violet-100 text-violet-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  STOPPED: "bg-slate-200 text-slate-600",
  DECLINED: "bg-red-100 text-red-700",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLOR[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

const PAYMENT_COLOR: Record<PaymentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  DETAILS_SHARED: "bg-amber-100 text-amber-800",
  ON_HOLD: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-500 line-through",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_COLOR[status]}`}>
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}

const PACE: Record<Pace, [string, string]> = {
  done: ["Delivered", "text-emerald-700"],
  on_track: ["On track", "text-slate-600"],
  behind: ["Behind", "text-amber-700"],
  overdue: ["Overdue", "text-red-600"],
  not_started: ["", ""],
};

export function PaceLabel({ pace }: { pace: Pace }) {
  const [label, color] = PACE[pace];
  return label ? <span className={`text-xs font-medium ${color}`}>{label}</span> : null;
}

// `budget` bars warn as spend nears the limit; plain bars just fill up.
export function Progress({ value, max, budget }: { value: number; max: number; budget?: boolean }) {
  const ratio = max > 0 ? value / max : 0;
  const color = !budget ? "bg-violet-500" : ratio > 1 ? "bg-red-500" : ratio >= 0.9 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="link break-all">
      {children}
    </a>
  );
}

export function CreatorLink({ handle, id }: { handle: string; id: string }) {
  return (
    <Link href={`/creators/${id}`} className="link">
      @{handle}
    </Link>
  );
}

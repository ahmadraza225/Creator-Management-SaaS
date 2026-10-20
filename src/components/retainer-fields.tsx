import type { Retainer } from "@prisma/client";
import { SAMPLE_LABEL, STAGE_LABEL, STAGES } from "@/lib/labels";
import { inputDate } from "@/lib/format";

// Shared by the "new retainer" and "edit retainer" forms.
export function RetainerFields({ retainer }: { retainer?: Retainer }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label">Flat fee (USD)</label>
        <input className="input" name="flatFee" type="number" min={0} step={1} required defaultValue={retainer?.flatFee ?? ""} />
      </div>
      <div>
        <label className="label">Videos required</label>
        <input className="input" name="videosRequired" type="number" min={0} step={1} required defaultValue={retainer?.videosRequired ?? ""} />
      </div>
      <div>
        <label className="label">Upfront %</label>
        <input className="input" name="upfrontPercent" type="number" min={0} max={100} step={1} required defaultValue={retainer?.upfrontPercent ?? 50} />
      </div>
      <div>
        <label className="label">Stage</label>
        <select className="input" name="stage" defaultValue={retainer?.stage ?? "PROSPECT"}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Base commission %</label>
        <input className="input" name="affiliateCommissionPct" type="number" min={0} max={100} step="any" defaultValue={retainer?.affiliateCommissionPct ?? ""} />
      </div>
      <div>
        <label className="label">Shop ads commission %</label>
        <input className="input" name="adsCommissionPct" type="number" min={0} max={100} step="any" defaultValue={retainer?.adsCommissionPct ?? ""} />
      </div>
      <div>
        <label className="label">Sample</label>
        <select className="input" name="sampleStatus" defaultValue={retainer?.sampleStatus ?? "NOT_SENT"}>
          {Object.entries(SAMPLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Contract link</label>
        <input className="input" name="contractUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={retainer?.contractUrl ?? ""} />
      </div>
      <div>
        <label className="label">Start date</label>
        <input className="input" name="startDate" type="date" defaultValue={inputDate(retainer?.startDate ?? new Date())} />
      </div>
      <div>
        <label className="label">Due date</label>
        <input className="input" name="dueDate" type="date" defaultValue={inputDate(retainer?.dueDate)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Angles given</label>
        <input className="input" name="angles" placeholder='e.g. "Before you try X", "Visual hook"' defaultValue={retainer?.angles ?? ""} />
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label className="label">Notes</label>
        <textarea className="input" name="notes" rows={3} defaultValue={retainer?.notes ?? ""} />
      </div>
    </div>
  );
}

import type { Brand } from "@prisma/client";
import { saveBrand } from "@/app/actions";
import { PRIORITY_LABEL } from "@/lib/labels";

export function BrandForm({ brand }: { brand?: Brand }) {
  return (
    <form action={saveBrand} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <div className="sm:col-span-2">
        <label className="label">Brand name</label>
        <input className="input" name="name" required defaultValue={brand?.name} />
      </div>
      <div>
        <label className="label">Monthly retainer budget (USD)</label>
        <input className="input" name="monthlyBudget" type="number" min={0} step={1} required defaultValue={brand?.monthlyBudget ?? 0} />
      </div>
      <div>
        <label className="label">Priority</label>
        <select className="input" name="priority" defaultValue={brand?.priority ?? "MEDIUM"}>
          {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Retainer products</label>
        <textarea className="input" name="retainerProducts" rows={2} defaultValue={brand?.retainerProducts ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Affiliate products</label>
        <textarea className="input" name="affiliateProducts" rows={2} defaultValue={brand?.affiliateProducts ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Client notes (what the client wants)</label>
        <textarea className="input" name="clientNotes" rows={3} defaultValue={brand?.clientNotes ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Internal notes</label>
        <textarea className="input" name="internalNotes" rows={3} defaultValue={brand?.internalNotes ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={brand?.active ?? true} /> Active client
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <button className="btn">{brand ? "Save brand" : "Create brand"}</button>
      </div>
    </form>
  );
}

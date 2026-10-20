import Link from "next/link";
import { createRetainer } from "@/app/actions";
import { RetainerFields } from "@/components/retainer-fields";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewRetainerPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const { brandId } = await searchParams;
  const brands = await db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  if (brands.length === 0) {
    return (
      <>
        <PageHeader title="New retainer" />
        <div className="card p-5 text-sm">
          Add a brand first: <Link href="/brands/new" className="link">New brand</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="New retainer" subtitle="Upfront and final payments are created automatically from the fee and upfront %." />
      <form action={createRetainer} className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Brand</label>
            <select className="input" name="brandId" required defaultValue={brandId ?? ""}>
              <option value="" disabled>
                Pick a brand
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Creator TikTok handle or profile link</label>
            <input className="input" name="handle" required placeholder="@creator or https://www.tiktok.com/@creator" />
          </div>
        </div>
        <RetainerFields />
        <button className="btn">Create retainer</button>
      </form>
    </>
  );
}

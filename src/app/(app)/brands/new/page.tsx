import { BrandForm } from "@/components/brand-form";
import { PageHeader } from "@/components/ui";

export default function NewBrandPage() {
  return (
    <>
      <PageHeader title="New brand" />
      <div className="card p-5">
        <BrandForm />
      </div>
    </>
  );
}

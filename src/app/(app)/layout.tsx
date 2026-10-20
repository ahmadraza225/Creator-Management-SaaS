import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/auth";
import { logout } from "../actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white p-3 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-3 hidden px-3 pt-2 md:block">
          <div className="text-sm font-semibold">Creator Retainers</div>
          <div className="text-xs text-slate-500">Content strategy</div>
        </div>
        <Nav />
        <form action={logout} className="mt-4 hidden px-3 md:block">
          <div className="truncate text-xs text-slate-500">{session.email}</div>
          <button className="mt-1 text-xs font-medium text-slate-600 hover:underline">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

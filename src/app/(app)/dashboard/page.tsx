import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardClient } from "./dashboard-client";
import { getUserNotebooks, getUserStats } from "./data";

// Dashboard is auth-gated (layout already redirects). Force-dynamic to
// skip prerender and ensure each request sees the user's data.
export const dynamic = "force-dynamic";

const DashboardPage = async (): Promise<React.ReactNode> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    // Belt-and-suspenders: the (app) layout redirects, but if something
    // skips that (e.g. partial render), this handles it too.
    redirect("/login");
  }

  // Fetch notebooks and stats in parallel on the server so the HTML
  // paints with real data instead of spinners. React Query on the
  // client picks them up as initialData; subsequent navigations refetch
  // from /api/notebooks and /api/stats as usual.
  const [initialNotebooks, initialStats] = await Promise.all([
    getUserNotebooks(session.user.id),
    getUserStats(session.user.id),
  ]);

  return (
    <DashboardClient
      initialNotebooks={initialNotebooks}
      initialStats={initialStats}
    />
  );
};

export default DashboardPage;

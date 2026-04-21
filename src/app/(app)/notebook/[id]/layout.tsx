import { Suspense, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { getCachedSession } from "@/lib/auth-session";
import { NotebookTabs } from "./notebook-tabs";

// Inline tab-content skeleton — fits inside the tab area the NotebookTabs
// island renders, so navigation between tabs streams the new page without
// replacing the tab bar + source panel chrome.
const TabContentFallback = (): ReactNode => (
  <div className="p-4 space-y-3 fm-fade-in">
    <div className="fm-skel-bar" style={{ height: 32, width: 240 }} />
    <div className="fm-skel-bar mt-4" style={{ height: "60vh", borderRadius: 16 }} />
  </div>
);

const NotebookLayout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}): Promise<ReactNode> => {
  const { id } = await params;

  const session = await getCachedSession();
  if (!session?.user) {
    redirect("/login");
  }

  // Check ownership or collaborator access. 404 if not found / not allowed.
  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(
      sql`${eq(notebooks.id, id)} AND (${notebooks.userId} = ${session.user.id} OR EXISTS (
        SELECT 1 FROM notebook_collaborators
        WHERE notebook_collaborators.notebook_id = ${notebooks.id}
        AND notebook_collaborators.user_id = ${session.user.id}
      ))`,
    )
    .limit(1);

  if (!notebook) {
    notFound();
  }

  return (
    <NotebookTabs notebookId={id}>
      <Suspense fallback={<TabContentFallback />}>{children}</Suspense>
    </NotebookTabs>
  );
};

export default NotebookLayout;

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/app-providers";

const AppLayout = async ({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
};

export default AppLayout;

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";

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

  return <div>{children}</div>;
};

export default AppLayout;

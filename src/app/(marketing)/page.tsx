import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { auth } from "@/lib/auth";

const Page = async (): Promise<React.ReactNode> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/dashboard");
  return <LandingPage />;
};

export default Page;

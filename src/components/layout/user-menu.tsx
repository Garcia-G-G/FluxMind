"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings, CreditCard, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "@/lib/auth-client";

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const UserMenu = (): React.ReactNode => {
  const router = useRouter();
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const { user } = session;

  const handleSignOut = async (): Promise<void> => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none cursor-pointer">
        <div
          className="h-8 w-8 rounded-full p-[2px] shrink-0"
          style={{ background: "var(--fm-accent-gradient)" }}
        >
          <div
            className="h-full w-full rounded-full flex items-center justify-center text-[10px] font-medium"
            style={{ background: "var(--fm-surface)", color: "var(--fm-text)" }}
          >
            {getInitials(user.name)}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        style={{
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
        }}
      >
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: "var(--fm-text)" }}>
              {user.name}
            </span>
            <span className="text-xs" style={{ color: "var(--fm-text-tertiary)" }}>
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator style={{ background: "var(--fm-surface-border)" }} />
        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          style={{ borderRadius: 8, color: "var(--fm-text-secondary)" }}
        >
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          style={{ borderRadius: 8, color: "var(--fm-text-secondary)" }}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/settings/billing")}
          style={{ borderRadius: 8, color: "var(--fm-text-secondary)" }}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Billing
        </DropdownMenuItem>
        <DropdownMenuSeparator style={{ background: "var(--fm-surface-border)" }} />
        <DropdownMenuItem
          onClick={handleSignOut}
          style={{ borderRadius: 8, color: "var(--fm-error)" }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

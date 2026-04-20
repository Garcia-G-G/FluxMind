"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import {
  User,
  Palette,
  Bell,
  CreditCard,
  Shield,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { useSession, signOut } from "@/lib/auth-client";
import { useFluxTheme } from "@/components/shared/theme-provider";

type TabId = "profile" | "appearance" | "notifications" | "billing" | "security";

type Tab = {
  id: TabId;
  label: string;
  icon: LucideIcon;
  accent: string;
};

const TABS: Tab[] = [
  { id: "profile", label: "Profile", icon: User, accent: "var(--fm-accent-orange)" },
  { id: "appearance", label: "Appearance", icon: Palette, accent: "var(--fm-accent-violet)" },
  { id: "notifications", label: "Notifications", icon: Bell, accent: "var(--fm-accent-blue)" },
  { id: "billing", label: "Billing", icon: CreditCard, accent: "var(--fm-accent-rose)" },
  { id: "security", label: "Security", icon: Shield, accent: "var(--fm-accent-orange)" },
];

const inputStyle: React.CSSProperties = {
  background: "var(--fm-input-bg)",
  border: "1px solid var(--fm-input-border)",
  color: "var(--fm-text)",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 10,
  width: "100%",
  outline: "none",
  transition: "border-color 0.2s",
};

const SettingsPage = (): React.ReactNode => {
  const router = useRouter();
  const { data: session } = useSession();
  const { mode, setMode } = useFluxTheme();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [name, setName] = useState<string>(session?.user?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSaveProfile = (): void => {
    setIsSaving(true);
    window.setTimeout(() => setIsSaving(false), 600);
  };

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto fm-fade-in">
      <h1
        className="font-display text-3xl font-normal tracking-tight mb-1"
        style={{ color: "var(--fm-text)" }}
      >
        Settings
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--fm-text-secondary)" }}>
        Manage your account and preferences.
      </p>

      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: "220px 1fr" }}
      >
        {/* Side nav */}
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors text-left"
                style={{
                  background: isActive ? "var(--fm-surface-hover)" : "transparent",
                  color: isActive ? "var(--fm-text)" : "var(--fm-text-secondary)",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: isActive ? tab.accent : "var(--fm-text-tertiary)" }}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <div>
          {activeTab === "profile" && (
            <GlassCard padding="lg">
              <h2
                className="font-display text-xl font-normal mb-1"
                style={{ color: "var(--fm-text)" }}
              >
                Profile
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
                Your public profile information.
              </p>

              <div className="grid gap-4 max-w-md">
                <div>
                  <label
                    htmlFor="settings-name"
                    className="text-xs font-medium mb-1.5 block"
                    style={{ color: "var(--fm-text-secondary)" }}
                  >
                    Name
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-email"
                    className="text-xs font-medium mb-1.5 block"
                    style={{ color: "var(--fm-text-secondary)" }}
                  >
                    Email
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={session?.user?.email ?? ""}
                    disabled
                    style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-[filter,transform] hover:brightness-110 disabled:opacity-60"
                  style={{ background: "var(--fm-accent-orange)" }}
                >
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </GlassCard>
          )}

          {activeTab === "appearance" && (
            <GlassCard padding="lg">
              <h2
                className="font-display text-xl font-normal mb-1"
                style={{ color: "var(--fm-text)" }}
              >
                Appearance
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
                Pick how FluxMind looks.
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-md">
                {(["dark", "light"] as const).map((m) => {
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="text-left rounded-xl p-4 transition-colors"
                      style={{
                        background: "var(--fm-surface)",
                        border: `1px solid ${
                          isActive
                            ? "var(--fm-accent-violet)"
                            : "var(--fm-surface-border)"
                        }`,
                      }}
                    >
                      <p
                        className="text-sm font-medium capitalize"
                        style={{ color: "var(--fm-text)" }}
                      >
                        {m}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--fm-text-tertiary)" }}
                      >
                        {m === "dark" ? "Low-light friendly" : "Warm and bright"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {activeTab === "notifications" && (
            <GlassCard padding="lg">
              <h2
                className="font-display text-xl font-normal mb-1"
                style={{ color: "var(--fm-text)" }}
              >
                Notifications
              </h2>
              <p className="text-sm" style={{ color: "var(--fm-text-secondary)" }}>
                Coming soon
              </p>
            </GlassCard>
          )}

          {activeTab === "billing" && (
            <GlassCard padding="lg">
              <h2
                className="font-display text-xl font-normal mb-1"
                style={{ color: "var(--fm-text)" }}
              >
                Billing
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
                Your plan and usage.
              </p>

              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--fm-surface)",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className="text-lg font-medium"
                    style={{ color: "var(--fm-text)" }}
                  >
                    Free Plan
                  </h3>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        "color-mix(in srgb, var(--fm-success) 15%, transparent)",
                      color: "var(--fm-success)",
                    }}
                  >
                    Active
                  </span>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--fm-text-secondary)" }}
                >
                  Open beta · All features included
                </p>
              </div>
            </GlassCard>
          )}

          {activeTab === "security" && (
            <GlassCard padding="lg">
              <h2
                className="font-display text-xl font-normal mb-1"
                style={{ color: "var(--fm-text)" }}
              >
                Security
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
                Account access and sessions.
              </p>

              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-[filter,transform] hover:brightness-110 disabled:opacity-60"
                style={{
                  background:
                    "color-mix(in srgb, var(--fm-error) 10%, transparent)",
                  color: "var(--fm-error)",
                  border:
                    "1px solid color-mix(in srgb, var(--fm-error) 25%, transparent)",
                }}
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? "Signing out…" : "Sign out"}
              </button>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

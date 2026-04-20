import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import "@/styles/theme-tokens.css";
import "@/styles/animations.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FluxMind",
  description: "AI-powered knowledge intelligence platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FluxMind",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

const RootLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className={`${jakartaSans.variable} ${instrumentSerif.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;

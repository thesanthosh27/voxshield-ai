import type { Metadata } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

export const metadata: Metadata = {
  title: "VoxShield AI — Real-Time Voice Cloning Detection & Forensic Prevention",
  description: "Real-time AI voice clone detection, mimicry verification, and active forensic prevention platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Authentic Design Studio Fonts via Fontshare CDN */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap"
        />
      </head>
      <body className="bg-studio-bg text-studio-text antialiased relative min-h-screen selection:bg-studio-text selection:text-studio-bg">
        {/* Subtle Fine Film-Grain Noise Overlay (pointer-events-none) */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-50 opacity-[0.032]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Ambient Studio Grid */}
        <div className="fixed inset-0 studio-grid pointer-events-none z-0" />

        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

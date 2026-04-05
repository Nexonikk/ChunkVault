import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChunkVault — Reliable Recording Pipeline",
  description:
    "Zero data-loss chunk recording pipeline with OPFS durability, bucket storage, and DB acknowledgment.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-accent antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — ChunkVault",
  description: "Real-time chunk recording pipeline dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

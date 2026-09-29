import type { Metadata } from "next";
import "./globals.css";
import { MainLayout } from "@/components/layout/main-layout";

export const metadata: Metadata = {
  title: "PHC Resilience Grid | BRICS Track 3: Smart Health & Supply Chain",
  description: "Federated AI platform for national-scale health resource and supply chain management across Primary Health Centres.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased selection:bg-primary/10">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}


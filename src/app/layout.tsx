import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Husada CRM — Patient Relationship Management",
  description: "WhatsApp-based CRM for healthcare clinics. Manage patient conversations, leads, and team performance.",
  keywords: ["CRM", "healthcare", "WhatsApp", "patient management", "clinic"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        {children}
      </body>
    </html>
  );
}


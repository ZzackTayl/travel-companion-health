import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Companion Health",
  description:
    "Private-by-default preparation guidance for traveling with medicines.",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
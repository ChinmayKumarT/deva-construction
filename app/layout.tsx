import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deva Construction",
  description: "Construction site management dashboards by Deva Construction.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

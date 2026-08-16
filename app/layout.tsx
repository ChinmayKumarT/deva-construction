import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { IOSInstallBanner } from "@/components/IOSInstallBanner";
import { NavProgress } from "@/components/NavProgress";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deva Construction",
  description: "Construction site management dashboards by Deva Construction.",
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Deva",
  },
  icons: {
    icon: "/icon.png",
    apple: [
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#635bff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>
        <NavProgress />
        {children}
        <ServiceWorkerRegister />
        <IOSInstallBanner />
      </body>
    </html>
  );
}

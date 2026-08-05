import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deva Construction",
  description: "Construction site management dashboards by Deva Construction.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Deva Construction",
  },
  // Plain static links, not the app/icon.png file convention -- that
  // convention runs the image through Next's resize pipeline (needs the
  // `sharp` package, not installed here) since our source isn't a standard
  // square favicon size. This just serves the public/ file as-is.
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#7da3d6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

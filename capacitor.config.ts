import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.deva.construction",
  appName: "Deva Construction",
  // Required by Capacitor even when we use server.url. Any folder works.
  webDir: "public",
  server: {
    // Vercel-hosted web app — every UI change deploys here and the app picks it up.
    url: "https://deva-demo.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0F172A",
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.deva.construction",
  appName: "Deva Construction",
  // Required by Capacitor even when we use server.url. Any folder works.
  webDir: "public",
  server: {
    // The live web app (app.devaconstructions.in, hosted on Vercel) — every UI
    // change deploys here and the app picks it up.
    url: "https://app.devaconstructions.in",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0F172A",
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.construction.manager",
  appName: "Construction Manager",
  // Required by Capacitor even when we use server.url. Any folder works.
  webDir: "public",
  server: {
    // Replace this with your deployed Vercel URL after step 2 in the playbook.
    url: "https://deva-demo.vercel.app/admin/clients",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0F172A",
  },
};

export default config;

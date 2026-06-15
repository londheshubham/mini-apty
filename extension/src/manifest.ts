import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "Mini Apty",
  description: "Author and preview lightweight DAP walkthroughs on public websites.",
  version: "0.1.0",
  action: {
    default_title: "Mini Apty",
  },
  side_panel: {
    default_path: "sidepanel.html",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content/content-script.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["activeTab", "sidePanel", "scripting", "storage", "tabs"],
  host_permissions: ["http://*/*", "https://*/*"],
};

export default manifest;

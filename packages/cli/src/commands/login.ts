import {
  detectInstalledPortalProviders,
  launchPortalLogin,
  selectPortalProvider,
} from "../portal/index.js";

export async function loginCommand(providerId?: string): Promise<void> {
  const installedPortalProviders = await detectInstalledPortalProviders();

  if (installedPortalProviders.length === 0) {
    console.error(
      "\nNo portal providers detected.\n\n" +
        "Install a supported CLI first:\n" +
        "  - codex\n" +
        "  - claude\n" +
        "  - gemini\n"
    );
    process.exit(1);
  }

  const selectedPortal = await selectPortalProvider(
    installedPortalProviders,
    providerId
  );

  console.log(`\nLaunching ${selectedPortal.name} login...\n`);
  const exitCode = await launchPortalLogin(selectedPortal);
  if (typeof exitCode === "number" && exitCode !== 0) {
    process.exit(exitCode);
  }
}

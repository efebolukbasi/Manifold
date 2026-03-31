import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

export interface PortalProvider {
  id: "codex" | "claude" | "gemini";
  name: string;
  command: string;
  loginArgs: string[];
  launchArgs: string[];
}

const PORTAL_PROVIDERS: PortalProvider[] = [
  {
    id: "codex",
    name: "Codex",
    command: "codex",
    loginArgs: ["login"],
    launchArgs: [],
  },
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    loginArgs: [],
    launchArgs: [],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    loginArgs: [],
    launchArgs: [],
  },
];

export async function detectInstalledPortalProviders(): Promise<PortalProvider[]> {
  const providers = await Promise.all(
    PORTAL_PROVIDERS.map(async (provider) => {
      const installed = await isCommandAvailable(provider.command);
      return installed ? provider : null;
    })
  );

  return providers.filter(
    (provider): provider is PortalProvider => provider !== null
  );
}

export function getPortalProvider(id: string): PortalProvider | undefined {
  return PORTAL_PROVIDERS.find((provider) => provider.id === id);
}

export async function selectPortalProvider(
  providers: PortalProvider[],
  preferredId?: string
): Promise<PortalProvider> {
  if (providers.length === 0) {
    throw new Error("No portal providers are installed.");
  }

  if (preferredId) {
    const preferred = providers.find((provider) => provider.id === preferredId);
    if (!preferred) {
      throw new Error(
        `Portal provider "${preferredId}" is not installed. Installed: ${providers.map((provider) => provider.id).join(", ")}`
      );
    }
    return preferred;
  }

  if (providers.length === 1 || !process.stdin.isTTY || !process.stdout.isTTY) {
    return providers[0];
  }

  console.log("\nAvailable portal providers:\n");
  providers.forEach((provider, index) => {
    console.log(`  ${index + 1}. ${provider.name} (${provider.id})`);
  });

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = (await readline.question("\nSelect a provider: ")).trim();
      const numericIndex = Number(answer);

      if (
        Number.isInteger(numericIndex) &&
        numericIndex >= 1 &&
        numericIndex <= providers.length
      ) {
        return providers[numericIndex - 1];
      }

      const byId = providers.find((provider) => provider.id === answer);
      if (byId) {
        return byId;
      }

      console.log("Enter a number from the list or a provider id.");
    }
  } finally {
    readline.close();
  }
}

export async function launchPortalLogin(
  provider: PortalProvider
): Promise<number | null> {
  return runPortalCommand(provider.command, provider.loginArgs);
}

export async function launchPortalSession(
  provider: PortalProvider
): Promise<number | null> {
  return runPortalCommand(provider.command, provider.launchArgs);
}

async function isCommandAvailable(command: string): Promise<boolean> {
  const checker = process.platform === "win32" ? "where" : "which";

  return new Promise((resolve) => {
    const child = spawn(checker, [command], {
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function runPortalCommand(
  command: string,
  args: string[]
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      cwd: process.cwd(),
    });

    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
}

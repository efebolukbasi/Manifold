import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const forwardedArgs = process.argv.slice(2);
const tauriCliScript = resolve(
  packageDir,
  "node_modules",
  "@tauri-apps",
  "cli",
  "tauri.js",
);
const gnuToolchain = "stable-x86_64-pc-windows-gnu";
const gnuTarget = "x86_64-pc-windows-gnu";

function commandExists(command) {
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? ["", ".exe", ".cmd", ".bat"]
    : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      if (existsSync(resolve(entry, `${command}${extension}`))) {
        return true;
      }
    }
  }

  return false;
}

function rustupHasToolchain(toolchain) {
  const userHome = process.env.USERPROFILE ?? process.env.HOME;
  if (!userHome) {
    return false;
  }

  const rustupHome = process.env.RUSTUP_HOME ?? resolve(userHome, ".rustup");
  return existsSync(resolve(rustupHome, "toolchains", toolchain));
}

function getArgValue(flag) {
  const exact = `${flag}=`;
  for (let i = 0; i < forwardedArgs.length; i += 1) {
    const arg = forwardedArgs[i];
    if (arg === flag) {
      return forwardedArgs[i + 1] ?? null;
    }
    if (arg.startsWith(exact)) {
      return arg.slice(exact.length);
    }
  }
  return null;
}

const env = { ...process.env };
const args = ["dev", ...forwardedArgs];
const explicitTarget = getArgValue("--target");
const needsWindowsFallback = process.platform === "win32" && !commandExists("link");

if (needsWindowsFallback && !env.RUSTUP_TOOLCHAIN) {
  const hasGnuToolchain = rustupHasToolchain(gnuToolchain);
  const hasGcc = commandExists("gcc");

  if (explicitTarget && explicitTarget !== gnuTarget) {
    console.error(
      `MSVC linker not found and the requested target is '${explicitTarget}'. Install Visual Studio Build Tools with C++, or rerun with '--target ${gnuTarget}'.`,
    );
    process.exit(1);
  }

  if (!hasGnuToolchain || !hasGcc) {
    console.error(
      `MSVC linker not found. Install Visual Studio Build Tools with C++, or install the GNU Rust toolchain ('rustup toolchain install ${gnuToolchain}') plus a MinGW/MSYS2 gcc toolchain.`,
    );
    process.exit(1);
  }

  env.RUSTUP_TOOLCHAIN = gnuToolchain;
  if (!explicitTarget) {
    args.push("--target", gnuTarget);
  }

  console.error(
    `MSVC linker not found; using ${gnuToolchain} for local Tauri dev.`,
  );
}

const result = spawnSync(process.execPath, [tauriCliScript, ...args], {
  cwd: packageDir,
  env,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

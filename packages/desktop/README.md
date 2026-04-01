# Desktop Development

## Windows

The Tauri desktop app can run locally on Windows with either of these toolchains:

- MSVC: Visual Studio Build Tools or Visual Studio with the C++ workload installed. This provides `link.exe`.
- GNU: `rustup toolchain install stable-x86_64-pc-windows-gnu` plus a MinGW/MSYS2 `gcc` toolchain on `PATH`.

`npm run dev` now detects whether `link.exe` is available. If it is missing and the GNU toolchain is installed, the script automatically runs Tauri with `stable-x86_64-pc-windows-gnu` and `--target x86_64-pc-windows-gnu`.

Before the frontend dev server starts, the desktop package also builds the workspace bridge dependencies and `bridge/dist/server.cjs`. This is required because the bridge runtime currently imports the built `dist` outputs from `@manifold/sdk`, `@manifold/core`, and `@manifold/adapter-claude`.

GitHub Releases still build on `windows-latest`, which already includes the MSVC toolchain.

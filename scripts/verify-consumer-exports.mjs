#!/usr/bin/env node
/**
 * TT-033: smoke ESM/CJS consumption via package.json `exports` (not direct dist paths).
 * Installs the publishable tarball from `npm pack` (not a workspace symlink).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const packDir = path.join(root, "tests", "consumers", ".pack");

function run(label, cwd, command) {
  console.log(`\n[verify:consumers] ${label}`);
  execSync(command, { cwd, stdio: "inherit", env: process.env });
}

function ensureBuild() {
  if (!fs.existsSync(path.join(root, "dist", "index.mjs"))) {
    console.log("[verify:consumers] dist/ missing — running build");
    execSync("npm run build", { cwd: root, stdio: "inherit" });
  }
}

function packSdkTarball() {
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.mkdirSync(packDir, { recursive: true });

  const tarballName = execSync("npm pack --pack-destination tests/consumers/.pack --silent", {
    cwd: root,
    encoding: "utf8",
  }).trim();

  const tarballPath = path.join(packDir, tarballName);
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`npm pack did not create expected tarball: ${tarballPath}`);
  }

  console.log(`[verify:consumers] packed ${tarballName}`);
  return tarballPath;
}

function runCjsTypecheck(dir) {
  run("cjs: types", dir, "npx tsc --noEmit -p tsconfig.json");

  console.log("\n[verify:consumers] cjs: require.types resolution");
  const trace = execSync("npx tsc --noEmit -p tsconfig.json --traceResolution 2>&1", {
    cwd: dir,
    encoding: "utf8",
  });
  if (!trace.includes("index.d.cts")) {
    throw new Error(
      "CJS typecheck did not resolve package.json exports.require.types (index.d.cts)",
    );
  }
}

ensureBuild();
const tarballPath = packSdkTarball();

const consumers = [
  { kind: "esm", runFile: "run.mjs" },
  { kind: "cjs", runFile: "run.cjs" },
];

for (const { kind, runFile } of consumers) {
  const dir = path.join(root, "tests", "consumers", kind);
  const tarballArg = JSON.stringify(tarballPath);
  run(`${kind}: npm install`, dir, `npm install --no-audit --no-fund ${tarballArg}`);
  run(`${kind}: runtime`, dir, `node ${runFile}`);
  if (kind === "cjs") {
    runCjsTypecheck(dir);
  } else {
    run(`${kind}: types`, dir, "npx tsc --noEmit -p tsconfig.json");
  }
}

console.log("\n[verify:consumers] all consumer export checks passed");

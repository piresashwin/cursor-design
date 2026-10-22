import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = path.resolve(here, "..");
const extensionTestsPath = path.resolve(here, "out/suite.js");

// Fresh temp workspace with a copy of the example, so the test never touches the user's playground file.
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-design-it-"));
fs.copyFileSync(path.resolve(here, "../../../examples/pulse.design.json"), path.join(workspace, "pulse.design.json"));

try {
  await runTests({
    version: process.env.VSCODE_VERSION ?? "stable",
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspace, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes"],
  });
} catch (e) {
  console.error("integration tests failed:", e);
  process.exit(1);
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}

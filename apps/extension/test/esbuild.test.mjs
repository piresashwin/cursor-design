import { build } from "esbuild";
await build({ entryPoints: ["test/suite/index.ts"], bundle: true, platform: "node", target: "node20", format: "cjs", outfile: "test/out/suite.js", external: ["vscode"], logLevel: "info" });

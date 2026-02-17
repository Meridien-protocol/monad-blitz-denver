#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactPath = join(__dirname, "out/MeridianCore.sol/MeridianCore.json");
const outputPath = join(__dirname, "../shared/src/abis/MeridianCore.ts");

const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const abi = JSON.stringify(artifact.abi, null, 2);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `// Auto-generated from forge build output. Do not edit.\nexport const MeridianCoreABI = ${abi} as const;\n`
);

console.log(`Exported ABI to ${outputPath} (${artifact.abi.length} entries)`);

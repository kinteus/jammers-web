#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function canRun(command, args) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

const mode = process.argv[2];

const hasDockerComposePlugin = canRun("docker", ["compose", "version"]);
const hasDockerComposeBinary = canRun("docker-compose", ["version"]);

if (mode === "down") {
  if (hasDockerComposePlugin) {
    run("docker", ["compose", "down"]);
  }

  if (hasDockerComposeBinary) {
    run("docker-compose", ["down"]);
  }

  console.log("Docker Compose was not found. Nothing to stop.");
  process.exit(0);
}

if (hasDockerComposePlugin) {
  console.log("Using Docker Compose plugin.");
  run("docker", ["compose", "up", "--build"]);
}

if (hasDockerComposeBinary) {
  console.log("Using standalone docker-compose.");
  run("docker-compose", ["up", "--build"]);
}

console.log("Docker Compose was not found. Falling back to native Next.js dev server.");
console.log("If you need the full containerized stack, install Docker Compose and run `npm run local` again.");
run("npm", ["run", "dev"]);

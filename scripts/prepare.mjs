#!/usr/bin/env node
import { execSync } from "node:child_process";

try {
	execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
} catch {
	// Not in a git work tree; skip hook setup.
	process.exit(0);
}

try {
	execSync("npx simple-git-hooks", { stdio: "inherit" });
} catch {
	// Hook setup failure is non-fatal and should not block install.
}

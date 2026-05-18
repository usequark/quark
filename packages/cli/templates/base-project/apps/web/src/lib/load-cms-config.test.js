import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { loadCmsConfig, resetCmsConfigCache } from "./load-cms-config.js";

const CONFIG_TEXT = `
export const cmsConfig = {
	contentTypes: {
		Page: { label: "Pages" },
	},
};
`;

function createFixture({ withConfig = true } = {}) {
	const root = mkdtempSync(join(tmpdir(), "quark-load-cms-config-"));

	if (withConfig) {
		mkdirSync(join(root, "packages/cms/src"), { recursive: true });
		writeFileSync(join(root, "packages/cms/src/config.js"), CONFIG_TEXT);
	}

	return {
		root,
		cleanup() {
			rmSync(root, { recursive: true, force: true });
		},
	};
}

async function withCwd(nextCwd, run) {
	const previousCwd = process.cwd();
	mkdirSync(nextCwd, { recursive: true });
	process.chdir(nextCwd);
	resetCmsConfigCache();

	try {
		return await run();
	} finally {
		resetCmsConfigCache();
		process.chdir(previousCwd);
	}
}

test("loadCmsConfig reads config from the web app cwd", async () => {
	const fixture = createFixture();

	try {
		const config = await withCwd(join(fixture.root, "apps/web"), () =>
			loadCmsConfig(),
		);

		assert.ok(config);
		assert.equal(config.contentTypes.Page.label, "Pages");
	} finally {
		fixture.cleanup();
	}
});

test("loadCmsConfig reads config from Next standalone cwd", async () => {
	const fixture = createFixture();

	try {
		const config = await withCwd(
			join(fixture.root, "apps/web/.next/standalone/apps/web"),
			() => loadCmsConfig(),
		);

		assert.ok(config);
		assert.equal(config.contentTypes.Page.label, "Pages");
	} finally {
		fixture.cleanup();
	}
});

test("loadCmsConfig returns null when config file is missing", async () => {
	const fixture = createFixture({ withConfig: false });

	try {
		const config = await withCwd(join(fixture.root, "apps/web"), () =>
			loadCmsConfig(),
		);

		assert.equal(config, null);
	} finally {
		fixture.cleanup();
	}
});

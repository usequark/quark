import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { loadCmsConfig, resetCmsConfigCache } from "./load-cms-config.js";

const CMS_CONFIG_TEXT = `
export const cmsConfig = {
	contentTypes: {
		Page: {
			label: "Pages",
		},
	},
	media: {
		maxFileSize: 1024,
		allowedTypes: ["image/png"],
	},
};
`;

function createFixture({ withCmsConfig = true } = {}) {
	const root = mkdtempSync(join(tmpdir(), "quark-cms-config-"));

	if (withCmsConfig) {
		mkdirSync(join(root, "packages/cms/src"), { recursive: true });
		writeFileSync(join(root, "packages/cms/src/config.js"), CMS_CONFIG_TEXT);
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

describe("CMS config resolution", () => {
	test("reads the config from the web app cwd", async () => {
		const fixture = createFixture();

		try {
			const cmsConfig = await withCwd(join(fixture.root, "apps/web"), () =>
				loadCmsConfig(),
			);

			assert.deepStrictEqual(cmsConfig, {
				contentTypes: {
					Page: {
						label: "Pages",
					},
				},
				media: {
					maxFileSize: 1024,
					allowedTypes: ["image/png"],
				},
			});
		} finally {
			fixture.cleanup();
		}
	});

	test("reads the config from a Next standalone cwd", async () => {
		const fixture = createFixture();

		try {
			const cmsConfig = await withCwd(
				join(fixture.root, "apps/web/.next/standalone/apps/web"),
				() => loadCmsConfig(),
			);

			assert.equal(cmsConfig?.contentTypes?.Page?.label, "Pages");
			assert.equal(cmsConfig?.media?.maxFileSize, 1024);
		} finally {
			fixture.cleanup();
		}
	});

	test("returns null when the CMS package is absent", async () => {
		const fixture = createFixture({ withCmsConfig: false });

		try {
			const cmsConfig = await withCwd(join(fixture.root, "apps/web"), () =>
				loadCmsConfig(),
			);

			assert.equal(cmsConfig, null);
		} finally {
			fixture.cleanup();
		}
	});
});

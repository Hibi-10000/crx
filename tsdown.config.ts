import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: [
        "src/cli.ts",
        "src/index.ts",
    ],
	unbundle: true,
	sourcemap: true,
	format: "esm",
	cjsDefault: false,
	fixedExtension: false,
	dts: {
		oxc: true,
	},
	skipNodeModulesBundle: true,
	platform: "node",
	copy: [
		"src/index.cjs",
		"src/index.d.cts",
	],
	report: {
		gzip: false,
	}
})

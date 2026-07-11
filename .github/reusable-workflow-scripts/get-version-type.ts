import { setGitHubOutput } from "../../cicd/core/github.ts";

const version = (Deno.env.get("VERSION") ?? "").trim();

if (version === "") {
	console.log("::error::Missing required environment variable: VERSION");
	Deno.exit(1);
}

const prodVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)$/;
const prevVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)-preview\.([1-9]\d*)$/;

const isProdVersion = prodVersionRegex.test(version);
const isPrevVersion = prevVersionRegex.test(version);

if (!isProdVersion && !isPrevVersion) {
	console.log(`::error::Invalid version format: ${version}. Must be in the format of 'vX.Y.Z' or 'vX.Y.Z-preview.N'`);

	Deno.exit(1);
}

if (isProdVersion) {
	setGitHubOutput("version-type", "production");
	Deno.exit();
}

if (isPrevVersion) {
	setGitHubOutput("version-type", "preview");
	Deno.exit();
}

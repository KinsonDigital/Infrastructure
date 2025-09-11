import getEnvVar from "../../../cicd/core/GetEnvVar.ts";
import { isNothing, printAsGitHubError } from "../../../cicd/core/Utils.ts";
import DenoConfig from "../../../deno.json" with { type: "json" };

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

if (isNothing(DenoConfig.version)) {
	printAsGitHubError(`The Deno version is not defined in the deno.json file.\n${scriptFileName}`);
	Deno.exit(1);
}

const githubOutputFilePath = getEnvVar("GITHUB_OUTPUT", scriptFileName);

const version = (DenoConfig.version.startsWith("v") ? DenoConfig.version : `v${DenoConfig.version}`).trim().toLocaleLowerCase();

const versionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?$/gm;

if (!versionRegex.test(version)) {
	printAsGitHubError(`The version '${version}' is not valid.\n\t\n${scriptFileName}`);
	Deno.exit(1);
}

try {
	Deno.writeTextFileSync(githubOutputFilePath, `version=${version}\n`, { append: true });
} catch (error) {
	if (error instanceof Error) {
		printAsGitHubError(`${error.message}\n${scriptFileName}`);
	} else {
		printAsGitHubError(`An unknown error occurred.\n${scriptFileName}`);
	}

	Deno.exit(1);
}

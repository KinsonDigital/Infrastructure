import getEnvVar from "../../../cicd/core/GetEnvVar.ts";
import { Utils } from "../../../cicd/core/Utils.ts";
import DenoConfig from "../../../deno.json" with { type: "json" };

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

if (Utils.isNothing(DenoConfig.version)) {
	Utils.printAsGitHubError(`The Deno version is not defined in the deno.json file.\n${scriptFileName}`);
	Deno.exit(1);
}

const githubOutputFilePath = getEnvVar("GITHUB_OUTPUT", scriptFileName);

const version = (DenoConfig.version.startsWith("v") 
	? DenoConfig.version.trim().toLocaleLowerCase()
	: `v${DenoConfig.version}`).trim().toLocaleLowerCase();

const versionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?$/gm;

if (!versionRegex.test(version)) {
	Utils.printAsGitHubError(`The version '${version}' is not valid.\n\t\n${scriptFileName}`);
	Deno.exit(1);
}

try {
	Deno.writeTextFileSync(githubOutputFilePath, `version=${version}\n`, { append: true });
} catch (error) {
	if (error instanceof Error) {
		Utils.printAsGitHubError(`${error.message}\n${scriptFileName}`);
	} else {
		Utils.printAsGitHubError(`An unknown error occurred.\n${scriptFileName}`);
	}

	Deno.exit(1);
}

import { NuGetClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/packaging";
import { printAsGitHubError, setGitHubOutput } from "../../cicd/core/github.ts";
import { getEnvVar } from "../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const outputName = "package-exists";
const packageName = getEnvVar("NUGET_PKG_NAME", scriptFileName);
let version = getEnvVar("NUGET_PKG_VERSION", scriptFileName);
const failIfExists = getEnvVar("FAIL_IF_EXISTS", scriptFileName).toLowerCase() === "true";

// NuGet package versions do not start with the letter 'v'
version = version.startsWith("v") ? version.substring(1) : version;

const client: NuGetClient = new NuGetClient();

const packageExists = await client.exists(packageName);

if (failIfExists && packageExists) {
	setGitHubOutput(outputName, "false");
	printAsGitHubError(`The NuGet package '${packageName}' already exists.`);
	Deno.exit(1);
}

const packageVersionExists: boolean = await client.exists(packageName, version);

if (failIfExists && packageVersionExists) {
	setGitHubOutput(outputName, "false");
	printAsGitHubError(`The NuGet package '${packageName}' with version '${version}' already exists.`);
	Deno.exit(1);
}

setGitHubOutput(outputName, packageExists && packageVersionExists ? "true" : "false");

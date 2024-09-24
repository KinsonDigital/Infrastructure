import { NuGetClient } from "../../deps.ts";
import getEnvVar from "../core/GetEnvVar.ts";
import { Utils } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const packageName = getEnvVar("NUGET_PKG_NAME", scriptFileName);
let version = getEnvVar("NUGET_PKG_VERSION", scriptFileName);

// NuGet package versions do not start with the letter 'v'
version = version.startsWith("v") ? version.substring(1) : version;

const client: NuGetClient = new NuGetClient();

const packageDoestNotExist = !(await client.packageExists(packageName));

if (packageDoestNotExist) {
	Utils.printAsGitHubError(`The NuGet package '${packageName}' does not exist.`);
	Deno.exit(1);
}

const packageVersionExists: boolean = await client.packageWithVersionExists(packageName, version);

if (packageVersionExists) {
	Utils.printAsGitHubError(`The NuGet package '${packageName}' with version '${version}' already exists.`);
	Deno.exit(1);
}

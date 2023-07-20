import { NuGetClient } from "../clients/NuGetClient.ts";
import { Utils } from "../core/Utils.ts";

if (Deno.args.length != 2) {
	let errorMsg = `The cicd script must have 2 arguments but has ${Deno.args.length} argument(s).`;
	errorMsg += "\nThe 1st arg is required and must be a valid NuGet package name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid NuGet package version.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const packageName = Deno.args[0].trim();
let version = Deno.args[1].trim();

// NuGet package versions do not start with the letter 'v'
version = version.startsWith("v") ? version.substring(1) : version;

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`NuGet Package Name (Required): ${packageName}`,
	`Package Version (Required): ${version}`,
]);

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

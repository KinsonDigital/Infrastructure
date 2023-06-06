import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

// Validate the arguments
if (Deno.args.length != 2) {
	let errorMsg = `The '${scriptName}' cicd script must have 2 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be a production or preview version.";

	errorMsg +=
		"\nThe 2nd arg is required and must be the version type.  Valid values are 'production', 'preview' or 'either'.";
	errorMsg += "\n\tThe production version syntax is as follows: v<major>.<minor>.<patch>";
	errorMsg += "\n\tThe preview version syntax is as follows: v<major>.<minor>.<patch>-preview.<preview number>";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const version: string = Deno.args[0].toLowerCase();
const versionType: string = Deno.args[1].toLowerCase();

const versionTypeInvalid = versionType != "production" && versionType != "preview" && versionType != "either";

if (versionTypeInvalid) {
	Utils.printAsGitHubError(
		`The version type argument '${versionType}' is invalid.  Valid values are 'production', 'preview' or 'either'.`,
	);
	Deno.exit(1);
}

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Version (Required): ${version}`,
	`Version Type (Required): ${versionType}`,
]);

const prodVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
const prevVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$/;

let versionIsInvalid = false;

switch (versionType) {
	case "production":
		versionIsInvalid = !prodVersionRegex.test(version);
		break;
	case "preview":
		versionIsInvalid = !prevVersionRegex.test(version);
		break;
	case "either":
		versionIsInvalid = !prodVersionRegex.test(version) || prevVersionRegex.test(version);
		break;
	default:
		break;
}

if (versionIsInvalid) {
	const tagTypeStr = version === "production" || version === "preview" ? version : "production or preview";

	let errorMsg = `\nThe version is not in the correct ${tagTypeStr} version syntax.`;
	errorMsg += "\n\tThe production version syntax is as follows: v<major>.<minor>.<patch>";
	errorMsg += "\n\tThe preview version syntax is as follows: v<major>.<minor>.<patch>-preview.<preview number>";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
} else {
	console.log(`✅The ${versionType} version '${version}' is a valid!!✅`);
}

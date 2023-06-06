import { Utils } from "../core/Utils.ts";
import { File } from "../core/File.ts";

const scriptName = Utils.getScriptName();

// Validate the arguments
if (Deno.args.length != 2) {
	let errorMsg = `The '${scriptName}' cicd script must have 2 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be either 'production', 'preview'.";
	errorMsg += "\nThe 2nd arg is required and must be the version of the notes.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

let releaseType: string = Deno.args[0].toLowerCase();
let version: string = Deno.args[1].toLowerCase();

const allButFirstLetter = releaseType.slice(1).toLowerCase();
const firstLetter = releaseType.slice(0, 1).toUpperCase();
releaseType = `${firstLetter}${allButFirstLetter}`;

version = version.startsWith("v") ? version : `v${version}`;

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Notes Type (Required): ${releaseType}`,
	`Version (Required): ${version}`,
]);

const releaseTypeValid = releaseType != "production" && releaseType != "preview";
const releaseTypeNotValid = !releaseTypeValid;

if (releaseTypeNotValid) {
	let errorMsg = "The notes type argument must be a value of 'production', 'preview'.";
	errorMsg += "\nThe value is case-insensitive.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const prodVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
const prevVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$/;

let isValid = false;

if (releaseType === "production") {
	isValid = prodVersionRegex.test(version);
} else {
	isValid = prevVersionRegex.test(version);
}

if (isValid === false) {
	Utils.printAsGitHubError(`The version is not in the correct ${releaseType} version syntax.`);
	Deno.exit(1);
}

const notesDirName = releaseType === "production" ? "ProductionReleases" : "PreviewReleases";

const notesFilePath = `${Deno.cwd()}/Documentation/ReleaseNotes/${notesDirName}/Release-Notes-${version}.md`;

if (File.DoesNotExist(notesFilePath)) {
	Utils.printAsGitHubError(`The release notes '${notesFilePath}' do not exist.`);
	Deno.exit(1);
}

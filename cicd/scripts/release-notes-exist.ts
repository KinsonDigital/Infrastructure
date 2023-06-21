import { Utils } from "../core/Utils.ts";
import { File } from "../core/File.ts";

const scriptName = Utils.getScriptName();

// Validate the arguments
if (Deno.args.length != 2) {
	let errorMsg = `The '${scriptName}' cicd script must have 2 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be a case-insensitive value of 'production' or 'preview'.";
	errorMsg += "\nThe 2nd arg is required and must be the version of the notes.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const releaseType: string = Deno.args[0].toLowerCase();
let version: string = Deno.args[1].toLowerCase();

version = version.startsWith("v") ? version : `v${version}`;

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Release Type (Required): ${releaseType}`,
	`Version (Required): ${version}`,
]);

const releaseTypeValid = releaseType === "production" || releaseType === "preview";

if (!releaseTypeValid) {
	let errorMsg = "The notes type argument must be a value of 'production', 'preview'.";
	errorMsg += "\nThe value is case-insensitive.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

let isNotValid = true;

if (releaseType === "production") {
	isNotValid = Utils.isNotValidProdVersion(version);
} else {
	isNotValid = Utils.isNotValidPreviewVersion(version);
}

if (isNotValid) {
	Utils.printAsGitHubError(`The version is not in the correct ${releaseType} version syntax.`);
	Deno.exit(1);
}

const baseDirPath = Deno.cwd();
const notesDirName = releaseType === "production" ? "ProductionReleases" : "PreviewReleases";
const relativeDirPath = `Documentation/ReleaseNotes/${notesDirName}`;
const fileName = `Release-Notes-${version}.md`;
const fullFilePath = `${baseDirPath}/${relativeDirPath}/${fileName}`;

let pathInfo = "::group:: Release Notes File Path Info";
pathInfo += `\nBase Directory Path: ${baseDirPath}`;
pathInfo += `\nRelative Directory Path: ${relativeDirPath}`;
pathInfo += `\nFile Name: ${fileName}`;
pathInfo += `\nFull File Path: ${fullFilePath}`;
pathInfo += "\n::endgroup::";

console.log(pathInfo);

if (File.DoesNotExist(fullFilePath)) {
	Utils.printAsGitHubError(`The release notes '${fullFilePath}' does not exist.`);
	Deno.exit(1);
}

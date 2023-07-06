import { Utils } from "../core/Utils.ts";
import { File } from "../core/File.ts";
import { OrgClient } from "../clients/OrgClient.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { IRepoVarModel } from "../core/Models/IRepoVarModel.ts";

const scriptName = Utils.getScriptName();

// Validate the arguments
if (Deno.args.length != 5) {
	let errorMsg = `The '${scriptName}' cicd script must have 3 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be organization name.";
	errorMsg += "\nThe 2nd arg is required and must be a repository name.";
	errorMsg += "\nThe 3rd arg is required and must be a case-insensitive value of 'production' or 'preview'.";
	errorMsg += "\nThe 4th arg is required and must be the version of the notes.";
	errorMsg += "\nThe 5th arg is required and must be the GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const orgName: string = Deno.args[0].trim();
const repoName: string = Deno.args[1].trim();
const releaseType: string = Deno.args[2].trim().toLowerCase();
let version: string = Deno.args[3].trim().toLowerCase();
const token: string = Deno.args[4].trim();

version = version.startsWith("v") ? version : `v${version}`;

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Organization Name (Required): ${orgName}`,
	`Repository Name (Required): ${repoName}`,
	`Release Type (Required): ${releaseType}`,
	`Version (Required): ${version}`,
	`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const releaseTypeValid = releaseType === "production" || releaseType === "preview";

if (!releaseTypeValid) {
	let errorMsg = "The notes type argument must be a value of 'production', 'preview'.";
	errorMsg += "\nThe value is case-insensitive.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

let versionNotValid = true;

if (releaseType === "production") {
	versionNotValid = Utils.isNotValidProdVersion(version);
} else {
	versionNotValid = Utils.isNotValidPreviewVersion(version);
}

if (versionNotValid) {
	Utils.printAsGitHubError(`The version is not in the correct ${releaseType} version syntax.`);
	Deno.exit(1);
}

const orgClient: OrgClient = new OrgClient(token);
const repoClient: RepoClient = new RepoClient(token);

const orgVars: IRepoVarModel[] = await orgClient.getVariables(orgName);
const repoVars: IRepoVarModel[] = await repoClient.getVariables(repoName);

const allVars: IRepoVarModel[] = [];

const repoVarsNotInOrg = repoVars.filter(repoVar => orgVars.find(orgVar => orgVar.name === repoVar.name) === undefined);

allVars.push(...orgVars);
allVars.push(...repoVarsNotInOrg);

const relativePrevReleaseNotesDirPathVarName = "RELATIVE_PREV_RELEASE_NOTES_DIR_PATH";
const relativeProdReleaseNotesDirPathVarName = "RELATIVE_PROD_RELEASE_NOTES_DIR_PATH";

let relativeDirPath = "";

if (releaseType === "production") {
	const relativeProdReleaseNotesDirPathVar = allVars.find(variable => variable.name === relativeProdReleaseNotesDirPathVarName);
	
	if (relativeProdReleaseNotesDirPathVar === undefined) {
		let errorMsg = `The '${scriptName}' cicd script requires an organization`;
		errorMsg += `\n or repository variable named '${relativeProdReleaseNotesDirPathVarName}' with a valid relative file path.`;
		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	relativeDirPath = relativeProdReleaseNotesDirPathVar.value;
} else {
	const relativePrevReleaseNotesDirPathVar = allVars.find(variable => variable.name === relativePrevReleaseNotesDirPathVarName);

	if (relativePrevReleaseNotesDirPathVar === undefined) {
		let errorMsg = `The '${scriptName}' cicd script requires an organization`;
		errorMsg += `\n or repository variable named '${relativePrevReleaseNotesDirPathVarName}' with a valid relative file path.`;
		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	relativeDirPath = relativePrevReleaseNotesDirPathVar.value;
}

const releaseNotesFileNamePrefixVarName = "RELEASE_NOTES_FILE_NAME_PREFIX";

const releaseNotesFileNamePrefixVar = allVars.find(variable => variable.name === releaseNotesFileNamePrefixVarName);

if (releaseNotesFileNamePrefixVar === undefined) {
	let errorMsg = `The '${scriptName}' cicd script requires an organization`;
	errorMsg += `\n or repository variable named '${releaseNotesFileNamePrefixVarName}'`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const releaseNotesFileNamePrefix = releaseNotesFileNamePrefixVar.value;
const baseDirPath = Deno.cwd();
const fileName = `${releaseNotesFileNamePrefix}${version}.md`;
const fullFilePath = `${baseDirPath}/${relativeDirPath}/${fileName}`;

let pathInfo = `\nBase Directory Path: ${baseDirPath}`;
pathInfo += `\nRelative Directory Path: ${relativeDirPath}`;
pathInfo += `\nFile Name: ${fileName}`;
pathInfo += `\nFull File Path: ${fullFilePath}`;

Utils.printInGroup("Release Notes File Path Info", pathInfo);

if (File.DoesNotExist(fullFilePath)) {
	Utils.printAsGitHubError(`The release notes '${fullFilePath}' does not exist.`);
	Deno.exit(1);
}

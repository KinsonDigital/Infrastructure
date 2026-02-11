import { XClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/social";
import { RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { existsSync } from "jsr:@std/fs@1.0.22";
import { getEnvVar, isNotValidPreviewVersion, isNotValidProdVersion } from "../../cicd/core/Utils.ts";
import { isNothing } from "../../cicd/core/guards.ts";
import { validateOrgExists, validateRepoExists } from "../../cicd/core/Validators.ts";
import { printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";

// TODO: Need to import this from kd-clients library once it is available
export interface XAuthValues {
	/**
	 * Gets or sets the consumer key.
	 */
	consumer_api_key: string;

	/**
	 * Gets or sets the consumer secret.
	 */
	consumer_api_secret: string;

	/**
	 * Gets or sets the access token key.
	 */
	access_token_key: string;

	/**
	 * Gets or sets the access token secret.
	 */
	access_token_secret: string;
}

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
let version = getEnvVar("VERSION", scriptFileName).toLowerCase();
const websiteUrl = (Deno.env.get("WEBSITE_URL") || "").trim(); // Optional
const consumerAPIKey = getEnvVar("X_CONSUMER_API_KEY", scriptFileName);
const consumerAPISecret = getEnvVar("X_CONSUMER_API_SECRET", scriptFileName);
const accessTokenKey = getEnvVar("X_ACCESS_TOKEN_KEY", scriptFileName);
const accessTokenSecret = getEnvVar("X_ACCESS_TOKEN_SECRET", scriptFileName);
const X_BROADCAST_ENABLED = "X_BROADCAST_ENABLED";
const xBroadcastEnabled = getEnvVar(X_BROADCAST_ENABLED, scriptFileName, false).toLowerCase();
const templateRepoName = (Deno.env.get("POST_TEMPLATE_REPO_NAME") ?? "").trim(); // Optional
const templateBranchName = (Deno.env.get("POST_TEMPLATE_BRANCH_NAME") ?? "").trim(); // Optional
const relativeTemplateFilePath = (Deno.env.get("POST_TEMPLATE_REPO_RELATIVE_FILE_PATH") ?? "").trim(); // Optional
const localPostTemplateFilePath = (Deno.env.get("LOCAL_POST_TEMPLATE_FILE_PATH") ?? "").trim(); // Optional
const discordInviteCode = (Deno.env.get("DISCORD_INVITE_CODE") ?? "").trim(); // Optional
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

version = version.startsWith("v") ? version : `v${version}`;

// Print info about the available template variables for use
const tempVarsInfoMsg = `The following template variables are available for use in the release announcement post template:` +
	"\n\tPROJECT_NAME" +
	"\n\tVERSION" +
	"\n\tWEBSITE_URL" +
	"\n\tNUGET_VERSION_VAR" +
	"\n\tREPO_OWNER_VAR" +
	"\n\tDISCORD_INVITE_CODE_VAR";
printAsGitHubNotice(tempVarsInfoMsg);

// If the local post template file path is not provided, and the repository inputs are provided
const getTemplateFromRemoteRepo = isNothing(localPostTemplateFilePath) &&
	!isNothing(templateRepoName) && !isNothing(templateBranchName) && !isNothing(relativeTemplateFilePath);

const getTemplateFromLocalFile = !isNothing(localPostTemplateFilePath);

await validateOrgExists(ownerName, token);

if (getTemplateFromRemoteRepo) {
	await validateRepoExists(ownerName, templateRepoName, token);
}

if (isNotValidPreviewVersion(version) && isNotValidProdVersion(version)) {
	let errorMsg = `The version '${version}' is not a valid preview or production version.`;
	errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

if (isNothing(xBroadcastEnabled) || xBroadcastEnabled === "false") {
	const noticeMsg = `No X post broadcast will be performed.` +
		`\nTo enable X post broadcasting, set the '${X_BROADCAST_ENABLED}' variable to 'true'.` +
		"\nIf the variable is missing, empty, or set to 'false', no X post broadcast will be performed.";
	printAsGitHubNotice(noticeMsg);
	Deno.exit(0);
}

const authValues: XAuthValues = {
	consumer_api_key: consumerAPIKey,
	consumer_api_secret: consumerAPISecret,
	access_token_key: accessTokenKey,
	access_token_secret: accessTokenSecret,
};

let templateFileData = "";

if (getTemplateFromRemoteRepo) {
	const repoClient = new RepoClient(ownerName, templateRepoName, token);

	const templateDoesNotExist = !(await repoClient.fileExists(templateBranchName, relativeTemplateFilePath));

	if (templateDoesNotExist) {
		printAsGitHubError(`The release X post template file '${relativeTemplateFilePath}' could not be found.`);
		Deno.exit(1);
	}

	templateFileData = await repoClient.getFileContent(templateBranchName, relativeTemplateFilePath);
} else if (getTemplateFromLocalFile) {
	// Check if the local file does not exist
	if (!existsSync(localPostTemplateFilePath)) {
		const errorMsg = `The local release X post template file '${localPostTemplateFilePath}' could not be found.` +
			"\nPlease ensure that the repository is checked out, the file exists at the specified path, or provide valid repository template inputs.";
		printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	templateFileData = await Deno.readTextFile(localPostTemplateFilePath);
} else {
	const errorMsg = "Missing required inputs for the release announcement post template." +
		"\nPlease provide either the 'local-post-template-file-path' input value or all of the " +
		"('post-template-repo-name', 'post-template-branch-name', 'post-template-repo-relative-file-path') input values." +
		"\nThe input 'local-post-template-file-path' input takes precedence over the repository template inputs.";
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const nugetVersion = version.startsWith("v") ? version.replace("v", "") : version;

let post = templateFileData.replaceAll(`{PROJECT_NAME}`, templateRepoName);
post = post.replaceAll(`{VERSION}`, version);
post = post.replaceAll("{WEBSITE_URL}", websiteUrl);
post = post.replaceAll(`{NUGET_VERSION_VAR}`, nugetVersion);
post = post.replaceAll(`{REPO_OWNER_VAR}`, ownerName);
post = post.replaceAll(`{DISCORD_INVITE_CODE_VAR}`, discordInviteCode);

const xClient: XClient = new XClient(authValues);
await xClient.tweet(post);

printAsGitHubNotice(`A release X post was successfully broadcasted for the '${templateRepoName}' project for version '${version}'.`);

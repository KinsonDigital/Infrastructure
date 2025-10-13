import { XClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/social";
import { ReleaseXPostBuilder } from "../core/ReleaseXPostBuilder.ts";
import { GitHubVariableService } from "../core/Services/GitHubVariableService.ts";
import {
getEnvVar,
	isNothing,
	isNotValidPreviewVersion,
	isNotValidProdVersion,
} from "../core/Utils.ts";
import { validateOrgExists, validateRepoExists } from "../core/Validators.ts";
import { printAsGitHubError, printAsGitHubNotice } from "../core/github.ts";

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
const repoName = getEnvVar("REPO_NAME", scriptFileName);
let version = getEnvVar("VERSION", scriptFileName).toLowerCase();
const consumerAPIKey = getEnvVar("X_CONSUMER_API_KEY", scriptFileName);
const consumerAPISecret = getEnvVar("X_CONSUMER_API_SECRET", scriptFileName);
const accessTokenKey = getEnvVar("X_ACCESS_TOKEN_KEY", scriptFileName);
const accessTokenSecret = getEnvVar("X_ACCESS_TOKEN_SECRET", scriptFileName);
const githubToken = getEnvVar("GITHUB_TOKEN", scriptFileName);

// TODO: update workflows to use these environment variables
const X_BROADCAST_ENABLED = "X_BROADCAST_ENABLED";
const xBroadcastEnabled = getEnvVar(X_BROADCAST_ENABLED, scriptFileName, false).toLowerCase();
const templateRepoName = getEnvVar("RELEASE_X_POST_TEMPLATE_REPO_NAME", scriptFileName);
const templateBranchName = getEnvVar("RELEASE_X_POST_TEMPLATE_BRANCH_NAME", scriptFileName);
const relativeTemplateFilePath = getEnvVar("RELATIVE_RELEASE_X_POST_TEMPLATE_FILE_PATH", scriptFileName);
const discordInviteCode = getEnvVar("DISCORD_INVITE_CODE", scriptFileName);

version = version.startsWith("v") ? version : `v${version}`;

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

if (isNotValidPreviewVersion(version) && isNotValidProdVersion(version)) {
	let errorMsg = `The version '${version}' is not a valid preview or production version.`;
	errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const githubVarService = new GitHubVariableService(ownerName, repoName, githubToken);
githubVarService.setOrgAndRepo(ownerName, repoName);

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

const postBuilder: ReleaseXPostBuilder = new ReleaseXPostBuilder(ownerName, templateRepoName, githubToken);

const post = await postBuilder.buildPost(
	templateBranchName,
	relativeTemplateFilePath,
	repoName,
	version,
	discordInviteCode,
);

const xClient: XClient = new XClient(authValues);
await xClient.tweet(post);

printAsGitHubNotice(`A release X post was successfully broadcasted for the '${repoName}' project for version '${version}'.`);

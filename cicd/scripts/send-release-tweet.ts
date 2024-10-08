import { XAuthValues } from "https://deno.land/x/kd_clients@v1.0.0-preview.8/OtherClients/XAuthValue.ts";
import { XClient } from "../../deps.ts";
import { ReleaseTweetBuilder } from "../core/ReleaseTweetBuilder.ts";
import { GitHubVariableService } from "../core/Services/GitHubVariableService.ts";
import { Utils } from "../core/Utils.ts";
import getEnvVar from "../core/GetEnvVar.ts";
import { validateOrgExists, validateRepoExists } from "../core/Validators.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
let version = getEnvVar("VERSION", scriptFileName).toLowerCase();
const consumerAPIKey = getEnvVar("TWITTER_CONSUMER_API_KEY", scriptFileName);
const consumerAPISecret = getEnvVar("TWITTER_CONSUMER_API_SECRET", scriptFileName);
const accessTokenKey = getEnvVar("TWITTER_ACCESS_TOKEN_KEY", scriptFileName);
const accessTokenSecret = getEnvVar("TWITTER_ACCESS_TOKEN_SECRET", scriptFileName);
const githubToken = getEnvVar("GITHUB_TOKEN", scriptFileName);

// TODO: update workflows to use these environment variables
const TWITTER_BROADCAST_ENABLED = "TWITTER_BROADCAST_ENABLED";
const twitterBroadcastEnabled = getEnvVar(TWITTER_BROADCAST_ENABLED, scriptFileName, false).toLowerCase();
const templateRepoName = getEnvVar("RELEASE_TWEET_TEMPLATE_REPO_NAME", scriptFileName);
const templateBranchName = getEnvVar("RELEASE_TWEET_TEMPLATE_BRANCH_NAME", scriptFileName);
const relativeTemplateFilePath = getEnvVar("RELATIVE_RELEASE_TWEET_TEMPLATE_FILE_PATH", scriptFileName);
const discordInviteCode = getEnvVar("DISCORD_INVITE_CODE", scriptFileName);

version = version.startsWith("v") ? version : `v${version}`;

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

if (Utils.isNotValidPreviewVersion(version) && Utils.isNotValidProdVersion(version)) {
	let errorMsg = `The version '${version}' is not a valid preview or production version.`;
	errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const githubVarService = new GitHubVariableService(ownerName, repoName, githubToken);
githubVarService.setOrgAndRepo(ownerName, repoName);

if (Utils.isNothing(twitterBroadcastEnabled) || twitterBroadcastEnabled === "false") {
	const noticeMsg = `No tweet broadcast will be performed.` +
		`\nTo enable tweet broadcasting, set the '${TWITTER_BROADCAST_ENABLED}' variable to 'true'.` +
		"\nIf the variable is missing, empty, or set to 'false', no tweet broadcast will be performed.";
	Utils.printAsGitHubNotice(noticeMsg);
	Deno.exit(0);
}

const authValues: XAuthValues = {
	consumer_api_key: consumerAPIKey,
	consumer_api_secret: consumerAPISecret,
	access_token_key: accessTokenKey,
	access_token_secret: accessTokenSecret,
};

const tweetBuilder: ReleaseTweetBuilder = new ReleaseTweetBuilder(ownerName, templateRepoName, githubToken);

const tweet = await tweetBuilder.buildTweet(
	templateBranchName,
	relativeTemplateFilePath,
	repoName,
	version,
	discordInviteCode,
);

const twitterClient: XClient = new XClient(authValues);
await twitterClient.tweet(tweet);

Utils.printAsGitHubNotice(`A release tweet was successfully broadcasted for the '${repoName}' project for version '${version}'.`);

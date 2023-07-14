import { TwitterClient } from "../clients/TwitterClient.ts";
import { TwitterAuthValues } from "../core/Models/TwitterAuthValues.ts";
import { RepoVarModel } from "../core/Models/RepoVarModel.ts";
import { Utils } from "../core/Utils.ts";
import { ReleaseTweetBuilder } from "../core/ReleaseTweetBuilder.ts";
import { OrgClient } from "../clients/OrgClient.ts";
import { RepoClient } from "../clients/RepoClient.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 7) {
	let errorMsg = `The '${scriptName}' cicd script must have 4 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be a repository owner.";
	errorMsg += "\nThe 2nd arg is required and must be a project name";
	errorMsg += "\nThe 3rd arg is required and must be a valid version. ";
	errorMsg += "\nThe 4th arg is required and must be a valid twitter consumer api key.";
	errorMsg += "\nThe 5th arg is required and must be a valid twitter consumer api secret.";
	errorMsg += "\nThe 6th arg is required and must be a valid twitter access token key.";
	errorMsg += "\nThe 7th arg is required and must be a valid twitter access token secret.";
	errorMsg += "\nThe 8th arg is required and must be a GitHub PAT (Personal Access Token).";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const orgName = Deno.args[0].trim();
const repoName = Deno.args[1].trim();
let version = Deno.args[2].trim();
version = version.startsWith("v") ? version : `v${version}`;

const consumerAPIKey = Deno.args[3].trim();
const consumerAPISecret = Deno.args[4].trim();
const accessTokenKey = Deno.args[5].trim();
const accessTokenSecret = Deno.args[6].trim();
const token = Deno.args[7].trim();

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Organization Name (Required): ${orgName}`,
	`Repository Name (Required): ${repoName}`,
	`Version (Required): ${version}`,
	`Twitter Consumer API Key (Required): ****`,
	`Twitter Consumer API Secret (Required): ****`,
	`Twitter Access Token Key (Required): ****`,
	`Twitter Access Token Secret (Required): ****`,
	`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const orgClient: OrgClient = new OrgClient(token);
const repoClient: RepoClient = new RepoClient(token);

const orgVars = await orgClient.getVariables(orgName);
const repoVars = await repoClient.getVariables(repoName);

const allVars: RepoVarModel[] = [];

const repoVarsNotInOrg = repoVars.filter((repoVar) => orgVars.find((orgVar) => orgVar.name === repoVar.name) === undefined);

allVars.push(...orgVars);
allVars.push(...repoVarsNotInOrg);

const discordInviteCodeVarName = "DISCORD_INVITE_CODE";

// Check for the discord invite code
const discordInviteCodeVar = allVars.find((variable) => variable.name === discordInviteCodeVarName);

if (discordInviteCodeVar == undefined) {
	let errorMsg = `The '${scriptName}' cicd script requires an organization`;
	errorMsg += `\n or repository variable named '${discordInviteCodeVarName}' with a discord invite code.`;
	errorMsg += "\n                      https://discord.gg/abcde12345";
	errorMsg += "\n                                         |--------|";
	errorMsg += "\n                                              |";
	errorMsg += "\nInvite code is on the end of an invite URL----|";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

// Check for the relative template file repo name
const relativeTemplateFileRepoNameVarName = "RELEASE_TWEET_TEMPLATE_REPO_NAME";
const relativeTemplateFileRepoNameVar = allVars.find((variable) => variable.name === relativeTemplateFileRepoNameVarName);

if (relativeTemplateFileRepoNameVar == undefined) {
	let errorMsg = `The '${scriptName}' cicd script requires an organization`;
	errorMsg += `\n or repository variable named '${relativeTemplateFileRepoNameVarName}' with a valid repository name.`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

// Check for the relative template file path
const relativeTemplateFilePathVarName = "RELATIVE_RELEASE_TWEET_TEMPLATE_FILE_PATH";
const relativeTemplateFilePathVar = allVars.find((variable) => variable.name === relativeTemplateFilePathVarName);

if (relativeTemplateFilePathVar == undefined) {
	let errorMsg = `The '${scriptName}' cicd script requires an organization`;
	errorMsg += `\n or repository variable named '${relativeTemplateFilePathVarName}' with a valid relative file path.`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const discordInviteCode = discordInviteCodeVar.value.trim();
const templateRepoName = relativeTemplateFileRepoNameVar.value.trim();
const relativeTemplateFilePath = relativeTemplateFilePathVar.value.trim();

const authValues: TwitterAuthValues = {
	consumer_api_key: consumerAPIKey,
	consumer_api_secret: consumerAPISecret,
	access_token_key: accessTokenKey,
	access_token_secret: accessTokenSecret,
};

const tweetBuilder: ReleaseTweetBuilder = new ReleaseTweetBuilder();

const tweet = await tweetBuilder.buildTweet(
	orgName,
	templateRepoName,
	repoName,
	relativeTemplateFilePath,
	version,
	discordInviteCode,
);

const twitterClient: TwitterClient = new TwitterClient(authValues);
twitterClient.tweet(tweet);

import { TwitterClient } from "../core/TwitterClient.ts";
import { ITwitterAuthValues } from "../core/Models/ITwitterAuthValues.ts";
import { Utils } from "../core/Utils.ts";
import { ReleaseTweetBuilder } from "../core/ReleaseTweetBuilder.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 8) {
	let errorMsg = `The '${scriptName}' cicd script must have 4 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be a project name";
	errorMsg += "\nThe 2nd arg is required and must be a valid version. ";
	errorMsg += "\nThe 3rd arg is required and must be a repository owner.";
	errorMsg += "\nThe 4th arg is required and must be a valid discord invite id.";
	errorMsg += "\nThe 5th arg is required and must be a valid twitter consumer api key.";
	errorMsg += "\nThe 6th arg is required and must be a valid twitter consumer api secret.";
	errorMsg += "\nThe 7th arg is required and must be a valid twitter access token key.";
	errorMsg += "\nThe 8th arg is required and must be a valid twitter access token secret.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const projectName = Deno.args[0].trim();
let version = Deno.args[1].trim();
version = version.startsWith("v") ? version : `v${version}`;
const repoOwner = Deno.args[2].trim();
const discordId = Deno.args[3].trim();
const consumerAPIKey = Deno.args[4].trim();
const consumerAPISecret = Deno.args[5].trim();
const accessTokenKey = Deno.args[6].trim();
const accessTokenSecret = Deno.args[7].trim();

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Project Name (Required): ${projectName}`,
	`Version (Required): ${version}`,
	`Repository Owner (Required): ${repoOwner}`,
	`Discord Invite ID (Required): ${discordId}`,
	`Twitter Consumer API Key (Required): ****`,
	`Twitter Consumer API Secret (Required): ****`,
	`Twitter Access Token Key (Required): ****`,
	`Twitter Access Token Secret (Required): ****`,
]);

const authValues: ITwitterAuthValues = {
	consumer_api_key: consumerAPIKey,
	consumer_api_secret: consumerAPISecret,
	access_token_key: accessTokenKey,
	access_token_secret: accessTokenSecret,
};

const tweetBuilder: ReleaseTweetBuilder = new ReleaseTweetBuilder();

const tweet = tweetBuilder.buildTweet(projectName, repoOwner, version, discordId);

const twitterClient: TwitterClient = new TwitterClient(authValues);
twitterClient.tweet(tweet);

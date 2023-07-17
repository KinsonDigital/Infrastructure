import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { TwitterClient } from "../../clients/TwitterClient.ts";
import { ReleaseTweetBuilder } from "../../core/ReleaseTweetBuilder.ts";
import { GitHubVariableService } from "../../core/Services/GitHubVariableService.ts";
import { TwitterAuthValues } from "../../core/TwitterAuthValues.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Sends release tweets.
 */
export class SendReleaseTweetRunner extends ScriptRunner {
	private readonly githubVarService: GitHubVariableService;

	/**
	 * Initializes a new instance of the {@link SendReleaseTweetRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		super(args);

		const [orgName, repoName] = this.args;
		this.githubVarService = new GitHubVariableService(orgName, repoName, this.token);
	}

	public async run(): Promise<void> {
		const [orgName, repoName, version, consumerAPIKey, consumerAPISecret, accessTokenKey, accessTokenSecret] = this.args;

		// Print out all of the arguments
		Utils.printInGroup("Script Arguments", [
			`Organization Name (Required): ${orgName}`,
			`Repository Name (Required): ${repoName}`,
			`Version (Required): ${version}`,
			`Twitter Consumer API Key (Required): ****`,
			`Twitter Consumer API Secret (Required): ****`,
			`Twitter Access Token Key (Required): ****`,
			`Twitter Access Token Secret (Required): ****`,
			`GitHub Token (Required): "****"`,
		]);

		const twitterBroadcastEnabledVarName = "TWITTER_BROADCAST_ENABLED";
		let twitterBroadcastEnabled = await this.githubVarService.getValue(twitterBroadcastEnabledVarName, false);
		twitterBroadcastEnabled = twitterBroadcastEnabled.toLowerCase();

		if (Utils.isNullOrEmptyOrUndefined(twitterBroadcastEnabled) || twitterBroadcastEnabled === "false") {
			let noticeMsg = `No tweet broadcast will be performed.`;
			noticeMsg += `\nTo enable tweet broadcasting, set the '${twitterBroadcastEnabledVarName}' variable to 'true'.`;
			noticeMsg += "\nIf the variable is missing, empty, or set to 'false', no tweet broadcast will be performed.";
			Utils.printAsGitHubNotice(noticeMsg);
			Deno.exit(0);
		}

		// Get the discord invite code
		const discordInviteCodeVarName = "DISCORD_INVITE_CODE";
		const discordInviteCode = await this.githubVarService.getValue(discordInviteCodeVarName)
			.catch((_) => {
				let errorMsg = `The cicd script requires an organization`;
				errorMsg += `\n or repository variable named '${discordInviteCodeVarName}' with a discord invite code.`;
				errorMsg += "\n                      https://discord.gg/abcde12345";
				errorMsg += "\n                                         |--------|";
				errorMsg += "\n                                              |";
				errorMsg += "\nInvite code is on the end of an invite URL----|";

				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		// Get the relative template file repo name
		const relativeTemplateFileRepoNameVarName = "RELEASE_TWEET_TEMPLATE_REPO_NAME";
		const templateRepoName = await this.githubVarService.getValue(relativeTemplateFileRepoNameVarName)
			.catch((_) => {
				let errorMsg = `The cicd script requires an organization or repository variable named`;
				errorMsg +=`\n '${relativeTemplateFileRepoNameVarName}' with a valid repository name.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		const relativeTemplateFileBranchNameVarName = "RELEASE_TWEET_TEMPLATE_BRANCH_NAME";
		const templateBranchName = await this.githubVarService.getValue(relativeTemplateFileBranchNameVarName)
			.catch((_) => {
				let errorMsg = `The cicd script requires an organization or repository variable named `;
				errorMsg += `\n '${relativeTemplateFileBranchNameVarName}' with a valid repository name.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		// Get the relative template file path
		const relativeTemplateFilePathVarName = "RELATIVE_RELEASE_TWEET_TEMPLATE_FILE_PATH";
		const relativeTemplateFilePath = await this.githubVarService.getValue(relativeTemplateFilePathVarName)
			.catch((_) => {
				let errorMsg = `The cicd script requires an organization or repository variable named`;
				errorMsg += `\n '${relativeTemplateFilePathVarName}' with a valid relative file path.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

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
			templateBranchName,
			relativeTemplateFilePath,
			repoName,
			version,
			discordInviteCode,
		);

		const twitterClient: TwitterClient = new TwitterClient(authValues);
		await twitterClient.tweet(tweet);
	}

	/**
	 * @inheritdoc
	 */
	protected async validateArgs(args: string[]): Promise<void> {
		if (Deno.args.length != 8) {
			let errorMsg = `The cicd script must have 7 arguments but has ${args.length} argument(s).`;
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

		let [orgName, repoName, version] = args;

		orgName = orgName.trim();
		repoName = repoName.trim();

		const orgClient = new OrgClient(this.token);

		// If the org does not exist
		if (!(await orgClient.exists(orgName))) {
			Utils.printAsGitHubError(`The organization '${orgName}' does not exist.`);
			Deno.exit(1);
		}

		const repoClient = new RepoClient(this.token);

		// If the repo does not exist
		if (!(await repoClient.exists(repoName))) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		if (Utils.isNotValidPreviewVersion(version) || Utils.isNotValidProdVersion(version)) {
			let errorMsg = `The version '${version}' is not a valid preview or production version.`;
			errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [
			orgName,
			repoName,
			version,
			consumerAPIKey,
			consumerAPISecret,
			accessTokenKey,
			accessTokenSecret,
			token,
		] = args;

		orgName = orgName.trim();
		repoName = repoName.trim();

		version = version.trim().toLowerCase();
		version = version.startsWith("v") ? version : `v${version}`;

		consumerAPIKey = consumerAPIKey.trim();
		consumerAPISecret = consumerAPISecret.trim();
		accessTokenKey = accessTokenKey.trim();
		accessTokenSecret = accessTokenSecret.trim();
		token = token.trim();

		return [
			orgName,
			repoName,
			version,
			consumerAPIKey,
			consumerAPISecret,
			accessTokenKey,
			accessTokenSecret,
			token,
		];
	}
}

import { RepoClient } from "../clients/RepoClient.ts";
import { Guard } from "./Guard.ts";
import { Utils } from "./Utils.ts";

/**
 * Creates a release tweet based on a template.
 */
export class ReleaseTweetBuilder {
	private readonly PROJ_NAME_VAR = "PROJECT_NAME";
	private readonly VERSION_VAR = "VERSION";
	private readonly NUGET_VERSION_VAR = "NUGET_VERSION";
	private readonly REPO_OWNER_VAR = "REPO_OWNER";
	private readonly DISCORD_INVITE_CODE_VAR = "DISCORD_INVITE_CODE";
	private readonly repoClient: RepoClient;

	/**
	 * Creates a new instance of the {@link ReleaseTweetBuilder} class.
	 */
	constructor(token?: string) {
		this.repoClient = new RepoClient(token);
	}

	/**
	 * Creates a release tweet using a template.
	 * @param repoOwner The owner of the repository.
	 * @param tweetTemplateRepoName The name of the repository where the release tweet template is located.
	 * @param projectName The name of the project being released.
	 * @param relativeFilePath The relative file path to the release tweet template.
	 * @param version The version of the project being released.
	 * @param discordInviteCode The discord invite code.
	 * @returns The release tweet.
	 */
	public async buildTweet(
		repoOwner: string,
		tweetTemplateRepoName: string,
		projectName: string,
		relativeFilePath: string,
		version: string,
		discordInviteCode: string,
	): Promise<string> {
		Guard.isNullOrEmptyOrUndefined(repoOwner, "buildTweet", "repoOwner");
		Guard.isNullOrEmptyOrUndefined(tweetTemplateRepoName, "buildTweet", "repoName");
		Guard.isNullOrEmptyOrUndefined(projectName, "buildTweet", "projectName");
		Guard.isNullOrEmptyOrUndefined(relativeFilePath, "buildTweet", "relativeFilePath");
		Guard.isNullOrEmptyOrUndefined(version, "buildTweet", "version");
		Guard.isNullOrEmptyOrUndefined(discordInviteCode, "buildTweet", "discordInviteCode");

		version = version.startsWith("v") ? version : `v${version}`;

		const nugetVersion = version.startsWith("v") ? version.replace("v", "") : version;
		const templateDoesNotExist = !(await this.repoClient.fileExists(repoOwner, relativeFilePath));

		if (!templateDoesNotExist) {
			Utils.printAsGitHubError(`The release tweet template file '${relativeFilePath}' could not be found.`);
			Deno.exit(1);
		}

		const templateFileData: string = await this.repoClient.getFileContent(tweetTemplateRepoName, relativeFilePath);

		let tweet: string = templateFileData.replaceAll(`{${this.PROJ_NAME_VAR}}`, projectName);
		tweet = tweet.replaceAll(`{${this.VERSION_VAR}}`, version);
		tweet = tweet.replaceAll(`{${this.NUGET_VERSION_VAR}}`, nugetVersion);
		tweet = tweet.replaceAll(`{${this.REPO_OWNER_VAR}}`, repoOwner);
		tweet = tweet.replaceAll(`{${this.DISCORD_INVITE_CODE_VAR}}`, discordInviteCode);

		return tweet;
	}
}

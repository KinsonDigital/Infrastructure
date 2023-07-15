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
	 * Builds a release tweet based on a template that lives in a repository with a name that matches the given
	 * {@link repoName}, owned by the given {@link repoOwner}, on the given {@link branchName}.
	 * @param repoOwner The owner of the repository that contains the tweet template.
	 * @param repoName The name of the repository where the tweet template is located.
	 * @param branchName The name of the branch where the tweet template lives.
	 * @param relativeFilePath The file path to the tweet template relative to the root of the repository.
	 * @param projectName The name of the project being released.
	 * @param version The version of the project being released.
	 * @param discordInviteCode The discord invite code.
	 * @returns The release tweet.
	 */
	public async buildTweet(
		repoOwner: string,
		repoName: string,
		branchName: string,
		relativeFilePath: string,
		projectName: string,
		version: string,
		discordInviteCode: string,
	): Promise<string> {
		const funcName = "buildTweet";
		Guard.isNullOrEmptyOrUndefined(repoOwner, funcName, "repoOwner");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");
		Guard.isNullOrEmptyOrUndefined(branchName, funcName, "branchName");
		Guard.isNullOrEmptyOrUndefined(relativeFilePath, funcName, "relativeFilePath");
		Guard.isNullOrEmptyOrUndefined(projectName, funcName, "projectName");
		Guard.isNullOrEmptyOrUndefined(version, funcName, "version");
		Guard.isNullOrEmptyOrUndefined(discordInviteCode, funcName, "discordInviteCode");

		version = version.startsWith("v") ? version : `v${version}`;

		const nugetVersion = version.startsWith("v") ? version.replace("v", "") : version;
		const templateDoesNotExist = !(await this.repoClient.fileExists(repoOwner, relativeFilePath));

		if (!templateDoesNotExist) {
			Utils.printAsGitHubError(`The release tweet template file '${relativeFilePath}' could not be found.`);
			Deno.exit(1);
		}

		const templateFileData: string = await this.repoClient.getFileContent(repoName, branchName, relativeFilePath);

		let tweet: string = templateFileData.replaceAll(`{${this.PROJ_NAME_VAR}}`, projectName);
		tweet = tweet.replaceAll(`{${this.VERSION_VAR}}`, version);
		tweet = tweet.replaceAll(`{${this.NUGET_VERSION_VAR}}`, nugetVersion);
		tweet = tweet.replaceAll(`{${this.REPO_OWNER_VAR}}`, repoOwner);
		tweet = tweet.replaceAll(`{${this.DISCORD_INVITE_CODE_VAR}}`, discordInviteCode);

		return tweet;
	}
}

import { File } from "./File.ts";
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
	private readonly DISCORD_INVITE_ID_VAR = "DISCORD_INVITE_ID";
	private readonly releaseTweetFileName = "release-tweet-template.txt";

	/**
	 * Creates a release tweet using a template.
	 * @param projectName The name of the project being released.
	 * @param repoOwner The owner of the repository.
	 * @param version The version of the project being released.
	 * @param discordInviteId The discord invite id.
	 * @returns The release tweet.
	 */
	public buildTweet(projectName: string, repoOwner: string, version: string, discordInviteId: string): string {
		Guard.isNullOrEmptyOrUndefined(projectName, "buildTweet", "projectName");
		Guard.isNullOrEmptyOrUndefined(repoOwner, "buildTweet", "repoOwner");
		Guard.isNullOrEmptyOrUndefined(version, "buildTweet", "version");
		Guard.isNullOrEmptyOrUndefined(discordInviteId, "buildTweet", "discordInviteId");

		version = version.startsWith("v") ? version : `v${version}`;

		const nugetVersion = version.startsWith("v") ? version.replace("v", "") : version;
		const relativeFilePath = `../${this.releaseTweetFileName}`;
		const tweetTemplateExists: boolean = File.Exists(relativeFilePath);

		if (!tweetTemplateExists) {
			Utils.printAsGitHubError(`The release tweet template file '${this.releaseTweetFileName}' could not be found.`);
			Deno.exit(1);
		}

		const templateFileData: string = File.LoadFile(relativeFilePath);

		let tweet: string = templateFileData.replaceAll(`{${this.PROJ_NAME_VAR}}`, projectName);
		tweet = tweet.replaceAll(`{${this.VERSION_VAR}}`, version);
		tweet = tweet.replaceAll(`{${this.NUGET_VERSION_VAR}}`, nugetVersion);
		tweet = tweet.replaceAll(`{${this.REPO_OWNER_VAR}}`, repoOwner);
		tweet = tweet.replaceAll(`{${this.DISCORD_INVITE_ID_VAR}}`, discordInviteId);

		return tweet;
	}
}

import { RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { isNothing } from "./guards.ts";
import { printAsGitHubError } from "./github.ts";

/**
 * Creates a release post on the X platform based on a template.
 */
export class ReleaseXPostBuilder {
	private readonly PROJ_NAME_VAR = "PROJECT_NAME";
	private readonly VERSION_VAR = "VERSION";
	private readonly NUGET_VERSION_VAR = "NUGET_VERSION";
	private readonly REPO_OWNER_VAR = "REPO_OWNER";
	private readonly DISCORD_INVITE_CODE_VAR = "DISCORD_INVITE_CODE";
	private readonly repoClient: RepoClient;
	private readonly repoOwner: string;

	/**
	 * Creates a new instance of the {@link ReleaseXPostBuilder} class.
	 */
	constructor(repoOwner: string, repoName: string, token?: string) {
		this.repoOwner = repoOwner;
		this.repoClient = new RepoClient(repoOwner, repoName, token);
	}

	/**
	 * Builds a release post based on a template that lives in a repository.
	 * @param branchName The name of the branch where the post template lives.
	 * @param relativeFilePath The file path to the post template relative to the root of the repository.
	 * @param projectName The name of the project being released.
	 * @param version The version of the project being released.
	 * @param discordInviteCode The discord invite code.
	 * @returns The release post.
	 */
	public async buildPost(
		branchName: string,
		relativeFilePath: string,
		projectName: string,
		version: string,
		discordInviteCode: string,
	): Promise<string> {
		if (isNothing(branchName)) {
			throw new Error("branchName parameter cannot be null, undefined, or empty.");
		}
		if (isNothing(relativeFilePath)) {
			throw new Error("relativeFilePath parameter cannot be null, undefined, or empty.");
		}
		if (isNothing(projectName)) {
			throw new Error("projectName parameter cannot be null, undefined, or empty.");
		}
		if (isNothing(version)) {
			throw new Error("version parameter cannot be null, undefined, or empty.");
		}
		if (isNothing(discordInviteCode)) {
			throw new Error("discordInviteCode parameter cannot be null, undefined, or empty.");
		}

		version = version.startsWith("v") ? version : `v${version}`;

		const nugetVersion = version.startsWith("v") ? version.replace("v", "") : version;
		const templateDoesNotExist = !(await this.repoClient.fileExists(branchName, relativeFilePath));

		if (templateDoesNotExist) {
			printAsGitHubError(`The release X post template file '${relativeFilePath}' could not be found.`);
			Deno.exit(1);
		}

		const templateFileData: string = await this.repoClient.getFileContent(branchName, relativeFilePath);

		let post: string = templateFileData.replaceAll(`{${this.PROJ_NAME_VAR}}`, projectName);
		post = post.replaceAll(`{${this.VERSION_VAR}}`, version);
		post = post.replaceAll(`{${this.NUGET_VERSION_VAR}}`, nugetVersion);
		post = post.replaceAll(`{${this.REPO_OWNER_VAR}}`, this.repoOwner);
		post = post.replaceAll(`{${this.DISCORD_INVITE_CODE_VAR}}`, discordInviteCode);

		return post;
	}
}

import { HttpStatusCodes } from "../core/Enums.ts";
import { GitHubClient } from "../core/GitHubClient.ts";
import { Guard } from "../core/Guard.ts";
import { IRepoModel } from "../core/Models/IRepoModel.ts";
import { RepoNotFound } from "../core/Types.ts";
import { Utils } from "../core/Utils.ts";

/**
 * Provides a client for interacting with GitHub repositories.
 */
export class RepoClient extends GitHubClient {
	/**
	 * Initializes a new instance of the {@link RepoClient} class.
	 * @param token The GitHub token to use for authentication.
	 */
	constructor(token?: string) {
		super(token);
	}

	public async getRepo(repoName: string): Promise<IRepoModel | RepoNotFound> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getRepo", "repoName");

		repoName = repoName.trim();

		const url = `https://api.github.com/repos/${this.organization}/${repoName}`;

		const response: Response = await this.fetchGET(url);
		const responseData: IRepoModel | RepoNotFound = await this.getResponseData(response);

		if (response.status != 200) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
					Utils.printAsGitHubError(`The repo '${repoName}' was moved permanently.`);
					break;
				case HttpStatusCodes.Forbidden:
					Utils.printAsGitHubError(`You do not have permission to access the repo '${repoName}'.`);
					break;
				case HttpStatusCodes.NotFound:
					return { message: `The repo '${repoName}' was not found.` };
			}

			Deno.exit(1);
		}

		return responseData;
	}

	/**
	 * Checks if a repo exists.
	 * @param repoName The name of the repo to check.
	 * @returns True if the repo exists; otherwise, false.
	 */
	public async repoExists(repoName: string): Promise<boolean> {
		const repo: IRepoModel | RepoNotFound = await this.getRepo(repoName);

		if (Utils.isRepoNotFound(repo)) {
			return false;
		}

		return true;
	}
}

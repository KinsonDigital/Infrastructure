import { Guard } from "../core/Guard.ts";
import { LabelClient } from "./LabelClient.ts";
import { ITagModel } from "../core/Models/ITagModel.ts";
import { Utils } from "../core/Utils.ts";
import { GitHubHttpStatusCodes } from "../core/Enums.ts";
import { GitHubClient } from "../core/GitHubClient.ts";

/**
 * Provides a client for interacting with GitHub GIT tags.
 */
export class TagClient extends GitHubClient {
	private readonly labelClient: LabelClient;

	/**
	 * Initializes a new instance of the {@link TagClient} class.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no token is provided, then the client will not be authenticated.
	 */
	constructor(token?: string) {
		super(token);
		this.labelClient = new LabelClient(token);
	}

	/**
	 * Gets all of the tags for a repo with the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @returns The tags.
	 * @remarks Does not require authentication.
	 */
	public async getTags(repoName: string): Promise<ITagModel[]> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getTags", "repoName");

		const url = `${this.baseUrl}/${this.organization}/${repoName}/tags`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status === GitHubHttpStatusCodes.NotFound) {
			Utils.printAsGitHubError(`${response.status} - ${response.statusText}`);
			Deno.exit(1);
		}

		return <ITagModel[]> await this.getResponseData(response);
	}
}

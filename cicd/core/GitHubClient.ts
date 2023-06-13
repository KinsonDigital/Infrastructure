import { WebAPIClient } from "./WebAPIClient.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a base class for HTTP clients.
 */
export abstract class GitHubClient extends WebAPIClient {
	protected readonly organization = "KinsonDigital";
	protected readonly headers: Headers = new Headers();
	
	/**
	 * Initializes a new instance of the {@link WebAPIClient} class.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no token is provided, then the client will not be authenticated.
	*/
	constructor(token?: string) {
		super();

		this.baseUrl = "https://api.github.com/repos";
		this.headers.append("Accept", "application/vnd.github.v3+.json");
		this.headers.append("X-GitHub-Api-Version", "2022-11-28");

		if (!Utils.isNullOrEmptyOrUndefined(token)) {
			this.headers.append("Authorization", `Bearer ${token}`);
		}
	}

	/**
	 * Returns a value indicating whether or not a token was provided.
	 * @returns True if a token was provided; otherwise, false.
	 */
	protected containsToken(): boolean {
		return this.headers.has("Authorization");
	}
}

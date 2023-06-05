import { ErrorModel } from "./Models/GraphQLModels/ErrorModel.ts";
import { RequestResponseModel } from "./Models/GraphQLModels/RequestResponseModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a base class for HTTP clients.
 */
export abstract class GraphQLClient {
	protected readonly organization = "KinsonDigital";
	protected baseUrl = "https://api.github.com/graphql";
	protected readonly headers: Headers = new Headers();

	/**
	 * Initializes a new instance of the {@link GraphQLClient} class.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no token is provided, then the client will not be authenticated.
	 */
	constructor(token: string) {
		// this.headers.append("Accept", "application/vnd.github.v3+.json");
		this.headers.append("Authorization", `Bearer ${token}`);
	}

	/**
	 * Returns a value indicating whether or not a token was provided.
	 * @returns True if a token was provided; otherwise, false.
	 */
	protected containsToken(): boolean {
		return this.headers.has("Authorization");
	}

	/**
	 * Gets the response data from a request.
	 * @param {Response} response The response from a request.
	 * @param {boolean} throwWithErrors Whether or not to throw and error if the response contains errors.
	 * @returns {Promise<RequestResponseModel>} The response data.
	 * @remarks This method will throw an error if the response contains errors.
	 */
	protected async getResponseData(response: Response, throwWithErrors = true): Promise<RequestResponseModel> {
		const responseText = await response.text();
		const responseData = await JSON.parse(responseText);

		if (throwWithErrors === true && this.containsErrors(responseData)) {
			const errors: ErrorModel[] = this.getErrors(responseData);
			const errorMessages: string[] = errors.map((e) => e.message);
			const error = `${errorMessages.join("\n")}`;

			Utils.printAsGitHubError(error);
			Deno.exit(1);
		}

		return responseData;
	}

	/**
	 * Fetch a resource from the network. It returns a Promise that resolves to the
	 * {@link Response} to that request, whether it is successful or not.
	 * @param query The GraphQL query to use for the request.
	 * @returns The response from the request.
	 */
	protected async fetch(query: string): Promise<Response> {
		const body: string = JSON.stringify({ query });

		return await fetch(this.baseUrl, {
			method: "POST",
			body: body,
			headers: this.headers,
		});
	}

	/**
	 * Gets all of the errors from the response data.
	 * @param responseData The response data from the request.
	 * @returns The list of errors.
	 */
	private getErrors(responseData: RequestResponseModel): ErrorModel[] {
		if (this.containsErrors(responseData)) {
			const errors: ErrorModel[] | undefined = responseData["errors"];

			if (errors === undefined) {
				return [];
			}

			return errors;
		}

		return [];
	}

	/**
	 * Returns a value indicating whether or not the given {@link responseData} contains any errors.
	 * @param response The response to check if it contains an errors object.
	 * @returns True if the object contains errors, false otherwise.
	 */
	private containsErrors(
		responseData: RequestResponseModel,
		key = "errors",
	): responseData is RequestResponseModel & { [k in typeof key]: string } {
		return key in responseData;
	}
}
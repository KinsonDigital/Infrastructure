import { Guard } from "./Guard.ts";

/**
 * Provides a base class for HTTP clients.
 */
export abstract class WebAPIClient {
	protected readonly headers: Headers = new Headers();
	protected baseUrl = "";

	/**
	 * Gets the data from an HTTP response.
	 * @param response The HTTP response to get the data from.
	 * @returns The data from the response.
	 */
	protected async getResponseData<T>(response: Response): Promise<T> {
		const responseText: string = await response.text();

		return await JSON.parse(responseText);
	}

	/**
	 * Fetches a resource using the HTTP GET method.
	 * @param url The URL to the resource to fetch.
	 * @returns The response from the fetch request.
	 */
	protected async fetchGET(url: string): Promise<Response> {
		Guard.isNullOrEmptyOrUndefined(url, "fetchGET", "url");

		return await fetch(url, {
			method: "GET",
			headers: this.headers,
		});
	}

	/**
	 * Fetches a resource using the HTTP GET method.
	 * @param url The URL to the resource to fetch.
	 * @param body The body of the request.
	 * @returns The response from the fetch request.
	 */
	protected async fetchPATCH(url: string, body: string): Promise<Response> {
		Guard.isNullOrEmptyOrUndefined(url, "fetchGET", "url");

		return await fetch(url, {
			method: "PATCH",
			headers: this.headers,
			body: body,
		});
	}
}

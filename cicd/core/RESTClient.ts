import { Utils } from "./Utils.ts";

/**
 * Provides a base class for HTTP clients.
 */
export abstract class RESTClient {
    protected readonly organization = "KinsonDigital";
    protected baseUrl = "https://api.github.com/repos";
    protected readonly headers: Headers = new Headers();
    
    /**
     * Initializes a new instance of the {@link RESTClient} class.
     * @param token The GitHub token to use for authentication.
     * @remarks If no token is provided, then the client will not be authenticated.
     */
    constructor(token?: string) {
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
        return await fetch(url, {
            method: "PATCH",
            headers: this.headers,
            body: body,
        });
    }
}

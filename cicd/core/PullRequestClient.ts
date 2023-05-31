import { Guard } from "./Guard.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with pull requests.
 */
export class PullRequestClient {
    private readonly organization = "KinsonDigital";
    private readonly baseUrl = "https://api.github.com/repos";
    private readonly headers: Headers = new Headers();

    /**
     * Initializes a new instance of the PullRequestClient class.
     * @param token The GitHub token to use for authentication.
     * @remarks If no token is provided, then the client will not be authenticated.
     */
    constructor(token?: string) {
        this.headers.append("Accept", "application/vnd.github.v3+.json");
        this.headers.append("X-GitHub-Api-Version", "2022-11-28");

        if (token !== undefined && token !== null && token !== "") {
            this.headers.append("Authorization", `Bearer ${token}`);
        }
    }

    /**
     * Gets the labels for the pull request.
     * @param projectName The name of the project.
     * @param prNumber The number of the pull request.
     * @returns The labels for the pull request.
     * @remarks Does not require authentication.
     */
    public async getLabels(projectName: string, prNumber: number): Promise<string[]> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getLabels", "projectName");
        Guard.isLessThanOne(prNumber, "getLabels", "prNumber");

        const url = `${this.baseUrl}/${this.organization}/${projectName}/issues/${prNumber}/labels`;
        
        const response: Response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        const possibleStatusCodes = [301, 404, 410];

        // If there is an error
        if (possibleStatusCodes.includes(response.status)) {
            switch (response.status) {
                case 301:
                case 410:
                    console.log(`::error::The request to get labels returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404:
                    console.log(`::error::The pull request number '${prNumber}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }

        const responseData = await Utils.getResponseData(response);

        return responseData.map((label: any) => label.name);
    }

    /**
     * Gets a pull request for a given project.
     * @param projectName The name of the project.
     * @param prNumber The number of the pull request.
     * @returns The pull request.
     */
    public async getPullRequest(projectName: string, prNumber: number): Promise<any> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getPullRequest", "projectName");
        Guard.isLessThanOne(prNumber, "getPullRequest", "prNumber");

        const url = `${this.baseUrl}/${this.organization}/${projectName}/pulls/${prNumber}`;
        
        const response: Response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        const possibleStatusCodes = [304, 404, 500, 503];

        // If there is an error
        if (possibleStatusCodes.includes(response.status)) {
            switch (response.status) {
                case 304: // Not modified
                case 500: // Internal Error
                case 503: // Service Unavailable
                    console.log(`::error::The request to get pull request returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404: // Resource Not Found
                    console.log(`::error::The pull request number '${prNumber}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }

        const responseData = await Utils.getResponseData(response);

        return responseData;
    }

    /**
     * Adds a label to a pull request.
     * @param projectName The name of the project.
     * @param prNumber The number of the pull request.
     * @param label The name of the label to add.
     * @remarks Requires authentication.
     */
    public async addLabel(projectName: string, prNumber: number, label: string): Promise<void> {
        Guard.isNullOrEmptyOrUndefined(projectName, "addLabel", "projectName");
        Guard.isLessThanOne(prNumber, "addLabel", "prNumber");
        Guard.isNullOrEmptyOrUndefined(label, "addLabel", "label");

        let prLabels: string[] = await this.getLabels(projectName, prNumber);
        prLabels.push(label);
        
        // REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#update-an-issue
        const url = `${this.baseUrl}/${this.organization}/${projectName}/issues/${prNumber}`;
        
        const response: Response = await fetch(url, {
            method: "PATCH",
            headers: this.headers,
            body: JSON.stringify({ labels: prLabels }),
        });

        const possibleStatusCodes = [301, 403, 404, 410, 422, 503];

        // If there is an error
        if (possibleStatusCodes.includes(response.status)) {
            switch (response.status) {
                case 301: // Moved permanently
                case 410: // Gone
                case 422: // Validation failed, or the endpoint has been spammed
                case 503: // Service unavailable
                    console.log(`::error::The request to add label '${label}' returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404:
                    console.log(`::error::The pull request number '${prNumber}' does not exist.`);
                    break;
                case 403:
                    console.log(`::error::The request to add label '${label}' was forbidden.  Check the auth token.`);
                    break;
            }

            Deno.exit(1);
        }        
    }
}

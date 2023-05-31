import { IIssueModel } from "./Models/IIssueModel.ts";
import { ILabelModel } from "./Models/ILabelModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with issues.
 */
export class IssueClient {
    private readonly organization = "KinsonDigital";
    private readonly baseUrl = "https://api.github.com/repos";
    private readonly headers: Headers = new Headers();

    /**
     * Initializes a new instance of the IssueClient class.
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
     * Gets an issue for a given project.
     * @param projectName The name of the project.
     * @returns The issue.
     */
    public async getIssues(projectName: string): Promise<IIssueModel[]> {
        // TODO: Add param value checks

        // REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues
        const url = `${this.baseUrl}/${this.organization}/${projectName}/issues?state=all&page=1&per_page=100`;
        
        const response: Response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        const possibleStatusCodes = [301, 404, 422];

        // If there is an error
        if (possibleStatusCodes.includes(response.status)) {
            switch (response.status) {
                case 301: // Moved permanently
                case 422: // Validation failed, or the endpoint has been spammed
                    console.log(`::error::The request to get an issue returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404: // Resource Not Found
                    console.log(`::error::The organization '${this.organization}' or project '${projectName}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }

        const responseData = <IIssueModel[]>await Utils.getResponseData(response);

        return responseData;
    }

    /**
     * Adds a label to an issue.
     * @param projectName The name of the project.
     * @param issueNumber The number of an issue.
     * @param label The name of the label to add.
     * @remarks Requires authentication.
     */
    public async addLabel(projectName: string, issueNumber: number, label: string): Promise<void> {
        // REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#update-an-issue

        let prLabels: string[] = await this.getLabels(projectName, issueNumber);
        prLabels.push(label);

        const url = `${this.baseUrl}/${this.organization}/${projectName}/issues/${issueNumber}`;
        
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
                    console.log(`::error::An issue with the number '${issueNumber}' does not exist.`);
                    break;
                case 403:
                    console.log(`::error::The request to add label '${label}' was forbidden.  Check the auth token.`);
                    break;
            }

            Deno.exit(1);
        }        
    }

    /**
     * Gets the labels for an issue.
     * @param projectName The name of the project.
     * @param issueNumber The number of an issue.
     * @returns The labels for an issue.
     * @remarks Does not require authentication.
     */
     public async getLabels(projectName: string, issueNumber: number): Promise<string[]> {
        const url = `${this.baseUrl}/${this.organization}/${projectName}/issues/${issueNumber}/labels`;
        
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
                    console.log(`::error::An issue with the number '${issueNumber}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }

        const responseData = <ILabelModel[]>await Utils.getResponseData(response);

        return responseData.map((label: ILabelModel) => label.name);
    }
}

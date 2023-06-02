import { Client } from "./Client.ts";
import { Guard } from "./Guard.ts";
import { LabelClient } from "./LabelClient.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { ILabelModel } from "./Models/ILabelModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with issues.
 */
export class IssueClient extends Client {
    private readonly labelClient: LabelClient;

    /**
     * Initializes a new instance of the {@link IssueClient} class.
     * @param token The GitHub token to use for authentication.
     * @remarks If no token is provided, then the client will not be authenticated.
     */
    constructor(token?: string) {
        super(token);
        this.labelClient = new LabelClient(token);
    }

    /**
     * Gets all of the issues for a project that match the given {@link projectName}.
     * @param projectName The name of the project.
     * @returns The issue.
     * @remarks Does not require authentication.
     */
    public async getIssues(projectName: string): Promise<IIssueModel[]> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getIssues", "getIssues");

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
                    Utils.printAsGitHubError(`The request to get an issue returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404: // Resource Not Found
                    Utils.printAsGitHubError(`The organization '${this.organization}' or project '${projectName}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }

        const responseData = <IIssueModel[]>await Utils.getResponseData(response);

        return responseData;
    }

    /**
     * Adds the given {@link label} to an issue that matches the given {@link issueNumber} in a project
     * that matches the given {@link projectName}.
     * @param projectName The name of the project.
     * @param issueNumber The number of an issue.
     * @param label The name of the label to add.
     * @remarks Requires authentication.
     */
    public async addLabel(projectName: string, issueNumber: number, label: string): Promise<void> {
        Guard.isNullOrEmptyOrUndefined(projectName, "addLabel", "projectName");
        Guard.isLessThanOne(issueNumber, "addLabel", "issueNumber");
        Guard.isNullOrEmptyOrUndefined(label, "addLabel", "projectName");

        if (!this.containsToken()) {
            Utils.printAsGitHubError(`The request to add label '${label}' is forbidden.  Check the auth token.`);
            Deno.exit(1);
        }

        // First check that the label trying to be added exists in the project
        const labelDoesNotExist: boolean = !(await this.labelClient.labelExists(projectName, label));

        if (labelDoesNotExist) {
            const labelsUrl = `https://github.com/KinsonDigital/${projectName}/labels`;
            const issueUrl = `https://github.com/KinsonDigital/${projectName}/issues/618`;

            let errorMsg = `::error::The label '${label}' attempting to be added to issue '${issueNumber}' does not exist in the project '${projectName}'.`;
            errorMsg += `\nProject Labels: ${labelsUrl}`;
            errorMsg += `\nIssue: ${issueUrl}`;

            console.log(errorMsg);
            Deno.exit(1);
        }

        let prLabels: string[] = await this.getLabels(projectName, issueNumber);
        prLabels.push(label);
        
        // REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#update-an-issue
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
                    Utils.printAsGitHubError(`The request to add label '${label}' returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404:
                    Utils.printAsGitHubError(`An issue with the number '${issueNumber}' does not exist.`);
                    break;
                case 403:
                    Utils.printAsGitHubError(`The request to add label '${label}' was forbidden.  Check the auth token.`);
                    break;
            }

            Deno.exit(1);
        }        
    }

    /**
     * Gets all of the labels for an issue that matches the given {@link issueNumber} in a project
     * that matches the given {@link projectName}.
     * @param projectName The name of the project.
     * @param issueNumber The number of an issue.
     * @returns The labels for an issue.
     * @remarks Does not require authentication.
     */
    public async getLabels(projectName: string, issueNumber: number): Promise<string[]> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getLabels", "projectName");
        Guard.isLessThanOne(issueNumber, "getLabels", "issueNumber");

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
                    Utils.printAsGitHubError(`The request to get labels returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404:
                    Utils.printAsGitHubError(`An issue with the number '${issueNumber}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }

        const responseData = <ILabelModel[]>await Utils.getResponseData(response);

        return responseData.map((label: ILabelModel) => label.name);
    }
}

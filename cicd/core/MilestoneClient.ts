import { Client } from "./Client.ts";
import { Guard } from "./Guard.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { IMilestoneModel } from "./Models/IMilestoneModel.ts";
import { IPullRequestModel } from "./Models/IPullRequestModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with milestones.
 */
export class MilestoneClient extends Client {
    /**
     * Initializes a new instance of the {@link MilestoneClient} class.
     * @param token The GitHub token to use for authentication.
     * @remarks If no token is provided, then the client will not be authenticated.
     */
    constructor(token?: string) {
        super(token);
    }

    /**
     * Gets all of the issues and pull requests for a milestone that matches the given {@link milestoneName}
     * in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo.
     * @param milestoneName The name of the milestone to get issues for.
     * @returns The issues in the milestone.
     */
    public async getIssuesAndPullRequests(repoName: string, milestoneName: string): Promise<IIssueModel[] | IPullRequestModel[]> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getIssuesAndPullRequests", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "getIssuesAndPullRequests", "milestoneName");

        const milestones: IMilestoneModel[] = await this.getMilestones(repoName);
        const milestone: IMilestoneModel | undefined = milestones.find((m) => m.title.trim() === milestoneName);

        if (milestone === undefined) {
            Utils.printAsGitHubError(`The milestone '${milestoneName}' does not exist.`);

            Deno.exit(1);
        }

        // NOTE: This API endpoint returns issues AND pull requests.
        const url = `${this.baseUrl}/${this.organization}/${repoName}/issues?milestone=${milestone.number}`;

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
                    Utils.printAsGitHubError(`The request to get issues returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404:
                    Utils.printAsGitHubError(`The milestone '${milestoneName}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }        

        return <IIssueModel[] | IPullRequestModel[]>await Utils.getResponseData(response);
    }

    /**
     * Gets all of the issues for a milestone that matches the given {@link milestoneName}
     * in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo.
     * @param milestoneName The name of the milestone to get issues for.
     * @returns The issues in the milestone.
     */
    public async getIssues(repoName: string, milestoneName: string): Promise<IIssueModel[]> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getIssues", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "getIssues", "milestoneName");

        const allMilestoneItems: IIssueModel[] = await this.getIssuesAndPullRequests(repoName, milestoneName);

        return Utils.filterIssues(allMilestoneItems);
    }

    /**
     * Gets all of the pull requests for a milestone that matches the given {@link milestoneName}
     * in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo.
     * @param milestoneName The name of the milestone to get pull requests for.
     * @returns The pull requests in the milestone.
     */
    public async getPullRequests(repoName: string, milestoneName: string): Promise<IPullRequestModel[]> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getPullRequests", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "getPullRequests", "milestoneName");

        const allMilestoneItems: IIssueModel[] | IPullRequestModel[] = await this.getIssuesAndPullRequests(repoName, milestoneName);

        return Utils.filterPullRequests(allMilestoneItems);
    }

    /**
     * Gets all of the milestones in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo that the milestone exists in.
     */
    public async getMilestones(repoName: string): Promise<IMilestoneModel[]> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getMilestones", "repoName");

        const url = `${this.baseUrl}/${this.organization}/${repoName}/milestones?state=all&page=1&per_page=100`;

        const response: Response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        // If there is an error
        if (response.status === 404) {
            Utils.printAsGitHubError(`The organization '${this.organization}' or repo '${repoName}' does not exist.`);
            Deno.exit(1);
        }

        return <IMilestoneModel[]>await Utils.getResponseData(response);
    }

    /**
     * Checks if a milestone exists that matches in the given {@link milestoneName} in a repo that
     * matches the given {@link repoName}.
     * @param repoName The name of the repo that the milestone exists in.
     * @param milestoneName The name of the milestone to check for.
     */
    public async milestoneExists(repoName: string, milestoneName: string): Promise<boolean> {
        Guard.isNullOrEmptyOrUndefined(repoName, "milestoneExists", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "milestoneExists", "milestoneName");

        const milestones: IMilestoneModel[] = await this.getMilestones(repoName);

        return milestones.some((m) => m.title.trim() === milestoneName);
    }
}

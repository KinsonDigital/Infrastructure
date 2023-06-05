import { RESTClient } from "./RESTClient.ts";
import { Guard } from "./Guard.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { IMilestoneModel } from "./Models/IMilestoneModel.ts";
import { IPullRequestModel } from "./Models/IPullRequestModel.ts";
import { Utils } from "./Utils.ts";
import { MilestoneNotFound } from "./Types.ts";

/**
 * Provides a client for interacting with milestones.
 */
export class MilestoneClient extends RESTClient {
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
     * @remarks Does not require authentication.
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

        const response: Response = await this.fetchGET(url);

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

        return <IIssueModel[] | IPullRequestModel[]>await this.getResponseData(response);
    }

    /**
     * Gets all of the issues for a milestone that matches the given {@link milestoneName}
     * in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo.
     * @param milestoneName The name of the milestone to get issues for.
     * @returns The issues in the milestone.
     * @remarks Does not require authentication.
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
     * @remarks Does not require authentication.
     */
    public async getPullRequests(repoName: string, milestoneName: string): Promise<IPullRequestModel[]> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getPullRequests", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "getPullRequests", "milestoneName");

        const allMilestoneItems: IIssueModel[] | IPullRequestModel[] = await this.getIssuesAndPullRequests(repoName, milestoneName);

        return Utils.filterPullRequests(allMilestoneItems);
    }

    /**
     * Get a milestones that matches the given {@link milestoneName} in a repository that matches the given {@link repoName}.
     * @param repoName The name of the repository that the milestone exists in.
     * @param milestoneName The name of the milestone.
     * @returns The milestone.
     * @remarks Does not require authentication.
     */
    public async getMilestone(repoName: string, milestoneName: string): Promise<IMilestoneModel | MilestoneNotFound> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getMilestone", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "getMilestone", "milestoneName");

        const milestones: IMilestoneModel[] = await this.getMilestones(repoName);
        const milestone: IMilestoneModel | undefined = milestones.find((m) => m.title.trim() === milestoneName);

        if (milestone === undefined) {
            return {
                statusCode: 404,
                statusText: `The milestone '${milestoneName}' does not exist.`,
            };
        }

        return milestone;
    }

    /**
     * Gets all of the milestones in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo that the milestone exists in.
     * @remarks Does not require authentication.
     */
    public async getMilestones(repoName: string): Promise<IMilestoneModel[]> {
        Guard.isNullOrEmptyOrUndefined(repoName, "getMilestones", "repoName");

        const url = `${this.baseUrl}/${this.organization}/${repoName}/milestones?state=all&page=1&per_page=100`;

        const response: Response = await this.fetchGET(url);
                // If there is an error
        if (response.status === 404) {
            Utils.printAsGitHubError(`The organization '${this.organization}' or repo '${repoName}' does not exist.`);
            Deno.exit(1);
        }

        return <IMilestoneModel[]>await this.getResponseData(response);
    }

    /**
     * Checks if a milestone exists that matches in the given {@link milestoneName} in a repo that
     * matches the given {@link repoName}.
     * @param repoName The name of the repo that the milestone exists in.
     * @param milestoneName The name of the milestone to check for.
     * @remarks Does not require authentication.
     */
    public async milestoneExists(repoName: string, milestoneName: string): Promise<boolean> {
        Guard.isNullOrEmptyOrUndefined(repoName, "milestoneExists", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "milestoneExists", "milestoneName");

        const milestones: IMilestoneModel[] = await this.getMilestones(repoName);

        return milestones.some((m) => m.title.trim() === milestoneName);
    }

    /**
     * Creates a new milestone in a repo that matches the given {@link repoName}.
     * @param repoName The name of the repo that the milestone exists in.
     * @param milestoneName The name of the milestone to close.
     * @remarks Requires authentication.
     */
    public async closeMilestone(repoName: string, milestoneName: string): Promise<void> {
        Guard.isNullOrEmptyOrUndefined(repoName, "closeMilestone", "repoName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "closeMilestone", "milestoneName");

        repoName = repoName.trim();
        milestoneName = milestoneName.trim();

        const milestone: IMilestoneModel | MilestoneNotFound = await this.getMilestone(repoName, milestoneName);

        if (Utils.isMilestoneNotFound(milestone)) {
            Utils.printAsGitHubError(`The milestone '${milestoneName}' does not exist.`);
            Deno.exit(1);
        }

        const url = `${this.baseUrl}/${this.organization}/${repoName}/milestones/${milestone.number}`;
        const response: Response = await this.fetchPATCH(url, JSON.stringify({ state: "closed", }));

        // If there is an error
        if (response.status === 404) {
            Utils.printAsGitHubError(`The organization '${this.organization}' or repo '${repoName}' does not exist.`);
            Deno.exit(1);
        }

        if (response.status !== 200) {
            Utils.printAsGitHubError(`The request to close milestone '${milestoneName}' returned error '${response.status} - (${response.statusText})'`);
            Deno.exit(1);
        }
    }
}

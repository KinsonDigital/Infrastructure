import { Client } from "./Client.ts";
import { Guard } from "./Guard.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { IMilestoneModel } from "./Models/IMilestoneModel.ts";
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
     * in a project that matches the given {@link projectName}.
     * @param projectName The name of the project.
     * @param milestoneName The name of the milestone to get issues for.
     * @returns The issues in the milestone.
     */
    public async getIssues(projectName: string, milestoneName: string): Promise<IIssueModel[]> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getIssues", "projectName");
        Guard.isNullOrEmptyOrUndefined(milestoneName, "getIssues", "milestoneName");

        const milestones: IMilestoneModel[] = await this.getMilestones(projectName);
        const milestone: IMilestoneModel | undefined = milestones.find((m) => m.title === milestoneName);

        if (milestone === undefined) {
            console.log(`::error::The milestone '${milestoneName}' does not exist.`);

            Deno.exit(1);
        }

        // NOTE: This API endpoint returns issues AND pull requests.
        const url = `${this.baseUrl}/${this.organization}/${projectName}/issues?milestone=${milestone.number}`;

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
                    console.log(`::error::The request to get issues returned error '${response.status} - (${response.statusText})'`);
                    break;
                case 404:
                    console.log(`::error::The milestone '${milestoneName}' does not exist.`);
                    break;
            }

            Deno.exit(1);
        }        

        return <IIssueModel[]>await Utils.getResponseData(response);
    }

    /**
     * Gets all of the milestones in a project that matches the given {@link projectName}.
     * @param projectName The name of the project that the milestone exists in.
     */
    public async getMilestones(projectName: string): Promise<IMilestoneModel[]> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getMilestones", "projectName");

        const url = `${this.baseUrl}/${this.organization}/${projectName}/milestones=?state=all&page=1&per_page=100`;

        const response: Response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        // If there is an error
        if (response.status === 404) {
            console.log(`::error::The organization '${this.organization}' or project '${projectName}' does not exist.`);
            Deno.exit(1);
        }

        return <IMilestoneModel[]>await Utils.getResponseData(response);
    }
}

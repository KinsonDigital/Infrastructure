import { IIssueModel } from "./Models/IIssueModel.ts";
import { IMilestoneModel } from "./Models/IMilestoneModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with milestones.
 */
export class MilestoneClient {
    private readonly organization = "KinsonDigital";
    private readonly baseUrl = "https://api.github.com/repos";
    private readonly headers: Headers = new Headers();

    /**
     * Initializes a new instance of the MilestoneClient class.
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
     * Gets all of the issues in the given milestone.
     * @param projectName The name of the project.
     * @param milestoneName The name of the milestone to get issues for.
     * @returns The issues in the milestone.
     */
    public async getIssues(projectName: string, milestoneName: string): Promise<IIssueModel[]> {
        const milestones: IMilestoneModel[] = await this.getMilestones(projectName);
        const milestone: IMilestoneModel | undefined = milestones.find((m) => m.title === milestoneName);

        if (milestone === undefined) {
            console.log(`::error::The milestone '${milestoneName}' does not exist.`);

            Deno.exit(1);
        }

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
     * Gets all of the milestones in the given project.
     * @param projectName The name of the project that the milestone exists in.
     */
    public async getMilestones(projectName: string): Promise<IMilestoneModel[]> {
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

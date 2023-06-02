import { Client } from "./Client.ts";
import { Guard } from "./Guard.ts";
import { LabelClient } from "./LabelClient.ts";
import { ITagModel } from "./Models/ITagModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with GitHub GIT tags.
 */
export class TagClient extends Client {
    private readonly labelClient: LabelClient;

    /**
     * Initializes a new instance of the {@link TagClient} class.
     * @param token The GitHub token to use for authentication.
     * @remarks If no token is provided, then the client will not be authenticated.
     */
    constructor(token?: string) {
        super(token);
        this.labelClient = new LabelClient(token);
    }

    /**
     * Gets all of the tags for a project with the given {@link projectName}.
     * @param projectName The name of the project.
     * @returns The tags.
     * @remarks Does not require authentication.
     */
    public async getTags(projectName: string): Promise<ITagModel[]> {
        Guard.isNullOrEmptyOrUndefined(projectName, "getTags", "projectName");

        const url = `${this.baseUrl}/${this.organization}/${projectName}/tags`;
        
        const response: Response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        // If there is an error
        if (response.status === 404) {
            Utils.printAsGitHubError(`${response.status} - ${response.statusText}`);
            Deno.exit(1);
        }

        return <ITagModel[]>await Utils.getResponseData(response);
    }
}

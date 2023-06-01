import { Client } from "./Client.ts";
import { ILabelModel } from "./Models/ILabelModel.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides a client for interacting with labels.
 */
export class LabelClient extends Client {
    /**
     * Initializes a new instance of the {@link LabelClient} class.
     * @param token The GitHub token to use for authentication.
     * @remarks If no {@link token} is provided, then the client will not be authenticated.
     */
    constructor(token?: string) {
        super(token);
    }

    /**
     * Gets a list of all the labels in the project that matches the {@link projectName}.
     * @param projectName The name of the project where the labels exist.
     * @returns A list of labels in the project.
     * @remarks Does not require authentication.
     */
    public async getLabels(projectName: string): Promise<ILabelModel[]> {
        const url = `${this.baseUrl}/${this.organization}/${projectName}/labels`;
        const response = await fetch(url, {
            method: "GET",
            headers: this.headers,
        });

        if (response.status === 404) {
            console.log(`::error::${response.status} - ${response.statusText}`);
            Deno.exit(1);
        }

        return <ILabelModel[]>await Utils.getResponseData(response);
    }

    /**
     * Returns a value indicating whether or not given {@link label} exists in
     * a project that matches the {@link projectName}.
     * @param projectName The name of the project where the labels exist.
     * @param label The name of the label to check for.
     * @returns True if the label exists, false otherwise.
     * @remarks Does not require authentication.
     */
    public async labelExists(projectName: string, label: string): Promise<boolean> {
        const labels = await this.getLabels(projectName);
        return labels.length > 0;
    }
}

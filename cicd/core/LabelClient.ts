import { RESTClient } from "./RESTClient.ts";
import { ILabelModel } from "./Models/ILabelModel.ts";
import { Utils } from "./Utils.ts";
import { HttpStatusCodes } from "./Enums.ts";

/**
 * Provides a client for interacting with labels.
 */
export class LabelClient extends RESTClient {
	/**
	 * Initializes a new instance of the {@link LabelClient} class.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no {@link token} is provided, then the client will not be authenticated.
	 */
	constructor(token?: string) {
		super(token);
	}

	/**
	 * Gets a list of all the labels in the repo that matches the {@link repoName}.
	 * @param repoName The name of the repo where the labels exist.
	 * @returns A list of labels in the repo.
	 * @remarks Does not require authentication.
	 */
	public async getLabels(repoName: string): Promise<ILabelModel[]> {
		const url = `${this.baseUrl}/${this.organization}/${repoName}/labels`;
		const response: Response = await this.fetchGET(url);

		if (response.status === HttpStatusCodes.NotFound) {
			Utils.printAsGitHubError(`${response.status} - ${response.statusText}`);
			Deno.exit(1);
		}

		return <ILabelModel[]> await this.getResponseData(response);
	}

	/**
	 * Returns a value indicating whether or not given {@link label} exists in
	 * a repo that matches the {@link repoName}.
	 * @param repoName The name of the repo where the labels exist.
	 * @param label The name of the label to check for.
	 * @returns True if the label exists, false otherwise.
	 * @remarks Does not require authentication.
	 */
	public async labelExists(repoName: string, label: string): Promise<boolean> {
		const labels = await this.getLabels(repoName);

		return labels.length > 0 && labels.some((l) => l.name.trim() === label.trim());
	}
}

import { ILabelModel } from "../core/Models/ILabelModel.ts";
import { Utils } from "../core/Utils.ts";
import { GitHubHttpStatusCodes } from "../core/Enums.ts";
import { GitHubClient } from "../core/GitHubClient.ts";
import { Guard } from "../core/Guard.ts";

/**
 * Provides a client for interacting with labels.
 */
export class LabelClient extends GitHubClient {
	/**
	 * Initializes a new instance of the {@link LabelClient} class.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no {@link token} is provided, then the client will not be authenticated.
	 */
	constructor(token?: string) {
		super(token);
	}

	/**
	 * Gets a page of labels with a set page size for a repository that matches the {@link repoName}.
	 * @param repoName The name of the repo where the labels exist.
	 * @param page The page of results to return.
	 * @param qtyPerPage The total to return per {@link page}.
	 * @returns A list of labels in the repo.
	 * @remarks Does not require authentication.
	 */
	public async getLabels(repoName: string, page: number, qtyPerPage: number): Promise<ILabelModel[]> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getLabels", "repoName");

		page = page < 1 ? 1 : page;
		qtyPerPage = Utils.clamp(qtyPerPage, 1, 100);

		const queryParams = `?page=${page}&per_page${qtyPerPage}`;
		const url = `${this.baseUrl}/${this.organization}/${repoName}/labels${queryParams}`;
		const response: Response = await this.fetchGET(url);

		if (response.status === GitHubHttpStatusCodes.NotFound) {
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
		const funcName = "labelExists";
		Guard.isNullOrEmptyOrUndefined(label, funcName, "label");
		Guard.isNullOrEmptyOrUndefined(label, funcName, "label");

		const url = `${this.baseUrl}/${this.organization}/${repoName}/labels${label}`;
		const response: Response = await this.fetchGET(url);

		if (response.status === GitHubHttpStatusCodes.NotFound) {
			return false;
		} else if (response.status === GitHubHttpStatusCodes.OK) {
			return true;
		} else {
			Utils.printAsGitHubError(
				`There was an issue getting the repository label '${label}'. ${response.status} - ${response.statusText}`,
			);
			Deno.exit(1);
		}
	}
}

import { Guard } from "../core/Guard.ts";
import { LabelClient } from "./LabelClient.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { Utils } from "../core/Utils.ts";
import { PullRequestNotFound } from "../core/Types.ts";
import { HttpStatusCodes } from "../core/Enums.ts";
import { ILabelModel } from "../core/Models/ILabelModel.ts";
import { GitHubClient } from "../core/GitHubClient.ts";

/**
 * Provides a client for interacting with pull requests.
 */
export class PullRequestClient extends GitHubClient {
	private readonly labelClient: LabelClient;

	/**
	 * Initializes a new instance of the {@link PullRequestClient} class.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no token is provided, then the client will not be authenticated.
	 */
	constructor(token?: string) {
		super(token);
		this.labelClient = new LabelClient(token);
	}

	/**
	 * Gets all of the pull requests for a repo that match the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @returns The issue.
	 * @remarks Does not require authentication.
	 */
	public async getPullRequests(repoName: string): Promise<IPullRequestModel[]> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getIssues", "getIssues");

		// TODO: Need to add pagination

		// REST API Docs: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests
		const url = `${this.baseUrl}/${this.organization}/${repoName}/pulls?state=all&page=1&per_page=100`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
				case HttpStatusCodes.ValidationFailed:
					Utils.printAsGitHubError(
						`The request to get a pull request returned error '${response.status} - (${response.statusText})'`,
					);
					break;
				case HttpStatusCodes.NotFound:
					Utils.printAsGitHubError(
						`The organization '${this.organization}' or repo '${repoName}' does not exist.`,
					);
					break;
			}

			Deno.exit(1);
		}

		return <IPullRequestModel[]> await this.getResponseData(response);
	}

	/**
	 * Gets all of the labels for a pull request that matches the given {@link prNumber} in a repo
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param prNumber The number of the pull request.
	 * @returns The labels for the pull request.
	 * @remarks Does not require authentication.
	 */
	public async getLabels(repoName: string, prNumber: number): Promise<string[]> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getLabels", "repoName");
		Guard.isLessThanOne(prNumber, "getLabels", "prNumber");

		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues/${prNumber}/labels`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
				case HttpStatusCodes.Gone:
					Utils.printAsGitHubError(
						`The request to get labels returned error '${response.status} - (${response.statusText})'`,
					);
					break;
				case HttpStatusCodes.NotFound:
					Utils.printAsGitHubError(`The pull request number '${prNumber}' does not exist.`);
					break;
			}

			Deno.exit(1);
		}

		const responseData = await this.getResponseData<ILabelModel[]>(response);

		return responseData.map((label: ILabelModel) => label.name);
	}

	/**
	 * Gets a pull request that matches the given {@link prNumber} in a repo
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param prNumber The number of the pull request.
	 * @returns The pull request.
	 * @remarks Does not require authentication.
	 */
	public async getPullRequest(repoName: string, prNumber: number): Promise<IPullRequestModel | PullRequestNotFound> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getPullRequest", "repoName");
		Guard.isLessThanOne(prNumber, "getPullRequest", "prNumber");

		// REST API Docs: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#get-a-pull-request
		const url = `${this.baseUrl}/${this.organization}/${repoName}/pulls/${prNumber}`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.NotModified:
				case HttpStatusCodes.InternalServerError:
				case HttpStatusCodes.ServiceUnavailable:
					Utils.printAsGitHubError(
						`The request to get pull request returned error '${response.status} - (${response.statusText})'`,
					);
					break;
				case HttpStatusCodes.NotFound:
					Utils.printAsGitHubError(`The pull request number '${prNumber}' does not exist.`);

					return { message: response.statusText };
			}

			Deno.exit(1);
		}

		return <IPullRequestModel> await this.getResponseData(response);
	}

	/**
	 * Adds the given {@link label} to a pull request that matches the given {@link prNumber} in a repo
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param prNumber The number of the pull request.
	 * @param label The name of the label to add.
	 * @remarks Requires authentication.
	 */
	public async addLabel(repoName: string, prNumber: number, label: string): Promise<void> {
		Guard.isNullOrEmptyOrUndefined(repoName, "addLabel", "repoName");
		Guard.isLessThanOne(prNumber, "addLabel", "prNumber");
		Guard.isNullOrEmptyOrUndefined(label, "addLabel", "label");

		if (!this.containsToken()) {
			Utils.printAsGitHubError(`The request to add label '${label}' is forbidden.  Check the auth token.`);
			Deno.exit(1);
		}

		// First check that the label trying to be added exists in the repo
		const labelDoesNotExist = !(await this.labelClient.labelExists(repoName, label));

		if (labelDoesNotExist) {
			const labelsUrl = `https://github.com/KinsonDigital/${repoName}/labels`;
			const prUrl = `https://github.com/KinsonDigital/${repoName}/pull/618`;

			let errorMsg =
				`::error::The label '${label}' attempting to be added to pull request '${prNumber}' does not exist in the repo '${repoName}'.`;
			errorMsg += `\nRepo Labels: ${labelsUrl}`;
			errorMsg += `\nPull Request: ${prUrl}`;

			console.log(errorMsg);
			Deno.exit(1);
		}

		const prLabels: string[] = await this.getLabels(repoName, prNumber);
		prLabels.push(label);

		// REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#update-an-issue
		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues/${prNumber}`;
		const response: Response = await this.fetchPATCH(url, JSON.stringify({ labels: prLabels }));

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
				case HttpStatusCodes.Gone:
				case HttpStatusCodes.ValidationFailed:
				case HttpStatusCodes.ServiceUnavailable:
					Utils.printAsGitHubError(
						`The request to add label '${label}' returned error '${response.status} - (${response.statusText})'`,
					);
					break;
				case HttpStatusCodes.NotFound:
					Utils.printAsGitHubError(`The pull request number '${prNumber}' does not exist.`);
					break;
				case HttpStatusCodes.Forbidden:
					Utils.printAsGitHubError(
						`The request to add label '${label}' was forbidden.  Check the auth token.`,
					);
					break;
			}

			Deno.exit(1);
		}
	}

	/**
	 * Checks if a pull request with the given {@link prNumber } pull request exists in a repo that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param prNumber The number of the pull request.
	 * @returns True if the pull request exists, otherwise false.
	 */
	public async pullRequestExists(repoName: string, prNumber: number): Promise<boolean> {
		Guard.isNullOrEmptyOrUndefined(repoName, "pullRequestExists", "repoName");
		Guard.isLessThanOne(prNumber, "pullRequestExists", "prNumber");

		// REST API Docs: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#list-pull-requests
		const url = `${this.baseUrl}/${this.organization}/${repoName}/pull/${prNumber}`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.NotModified:
				case HttpStatusCodes.InternalServerError:
				case HttpStatusCodes.ServiceUnavailable:
					Utils.printAsGitHubError(
						`The request to get an issue returned error '${response.status} - (${response.statusText})'`,
					);
					break;
				case HttpStatusCodes.NotFound:
					return false;
			}
		}

		return true;
	}
}

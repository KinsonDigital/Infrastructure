import { Guard } from "./Guard.ts";
import { LabelClient } from "./LabelClient.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { ILabelModel } from "./Models/ILabelModel.ts";
import { Utils } from "./Utils.ts";
import { IssueNotFound } from "./Types.ts";
import { HttpStatusCodes } from "./Enums.ts";
import { GitHubClient } from "./GitHubClient.ts";

/**
 * Provides a client for interacting with issues.
 */
export class IssueClient extends GitHubClient {
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
	 * Gets all of the issues for a repo that match the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @returns The issue.
	 * @remarks Does not require authentication.
	 */
	public async getIssues(repoName: string): Promise<IIssueModel[]> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getIssues", "getIssues");

		// TODO: Need to add pagination

		// REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues
		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues?state=all&page=1&per_page=100`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
				case HttpStatusCodes.ValidationFailed:
					Utils.printAsGitHubError(
						`The request to get an issue returned error '${response.status} - (${response.statusText})'`,
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

		return <IIssueModel[]> await this.getResponseData(response);
	}

	/**
	 * Gets an issue with the given {@link issueNumber} from a repository with the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @returns The issue.
	 */
	public async getIssue(repoName: string, issueNumber: number): Promise<IIssueModel | IssueNotFound> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getIssue", "repoName");
		Guard.isLessThanOne(issueNumber, "getIssue", "issueNumber");

		// REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#get-an-issue
		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues/${issueNumber}`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
				case HttpStatusCodes.NotModified:
				case HttpStatusCodes.NotFound:
					Utils.printAsGitHubError(`The repo '${repoName}' or issue '${issueNumber}' does not exist.`);

					return { message: response.statusText };
				case HttpStatusCodes.Gone:
					Utils.printAsGitHubError(
						`The request to get an issue returned error '${response.status} - (${response.statusText})'`,
					);
					break;
			}

			Deno.exit(1);
		}

		return <IIssueModel> await this.getResponseData(response);
	}

	/**
	 * Adds the given {@link label} to an issue that matches the given {@link issueNumber} in a repo
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param issueNumber The number of an issue.
	 * @param label The name of the label to add.
	 * @remarks Requires authentication.
	 */
	public async addLabel(repoName: string, issueNumber: number, label: string): Promise<void> {
		Guard.isNullOrEmptyOrUndefined(repoName, "addLabel", "repoName");
		Guard.isLessThanOne(issueNumber, "addLabel", "issueNumber");
		Guard.isNullOrEmptyOrUndefined(label, "addLabel", "repoName");

		if (!this.containsToken()) {
			Utils.printAsGitHubError(`The request to add label '${label}' is forbidden.  Check the auth token.`);
			Deno.exit(1);
		}

		// First check that the label trying to be added exists in the repo
		const labelDoesNotExist = !(await this.labelClient.labelExists(repoName, label));

		if (labelDoesNotExist) {
			const labelsUrl = `https://github.com/KinsonDigital/${repoName}/labels`;
			const issueUrl = `https://github.com/KinsonDigital/${repoName}/issues/618`;

			let errorMsg =
				`::error::The label '${label}' attempting to be added to issue '${issueNumber}' does not exist in the repo '${repoName}'.`;
			errorMsg += `\nRepo Labels: ${labelsUrl}`;
			errorMsg += `\nIssue: ${issueUrl}`;

			console.log(errorMsg);
			Deno.exit(1);
		}

		const prLabels: string[] = await this.getLabels(repoName, issueNumber);
		prLabels.push(label);

		// REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#update-an-issue
		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues/${issueNumber}`;

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
					Utils.printAsGitHubError(`An issue with the number '${issueNumber}' does not exist.`);
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
	 * Gets all of the labels for an issue that matches the given {@link issueNumber} in a repo
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param issueNumber The number of an issue.
	 * @returns The labels for an issue.
	 * @remarks Does not require authentication.
	 */
	public async getLabels(repoName: string, issueNumber: number): Promise<string[]> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getLabels", "repoName");
		Guard.isLessThanOne(issueNumber, "getLabels", "issueNumber");

		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues/${issueNumber}/labels`;

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
					Utils.printAsGitHubError(`An issue with the number '${issueNumber}' does not exist.`);
					break;
			}

			Deno.exit(1);
		}

		const responseData = <ILabelModel[]> await this.getResponseData(response);

		return responseData.map((label: ILabelModel) => label.name);
	}

	/**
	 * Checks if an issue with the given {@link issueNumber } issue exists in a repo that matches the given {@link repoName}.
	 * @param repoName The name of the repo.
	 * @param issueNumber The number of the issue.
	 * @returns True if the issue exists, otherwise false.
	 */
	public async issueExists(repoName: string, issueNumber: number): Promise<boolean> {
		Guard.isNullOrEmptyOrUndefined(repoName, "issueExists", "repoName");
		Guard.isLessThanOne(issueNumber, "issueExists", "issueNumber");

		// REST API Docs: https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#get-an-issue
		const url = `${this.baseUrl}/${this.organization}/${repoName}/issues/${issueNumber}`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status != HttpStatusCodes.OK) {
			switch (response.status) {
				case HttpStatusCodes.MovedPermanently:
				case HttpStatusCodes.NotModified:
				case HttpStatusCodes.Gone:
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

import { GitHubHttpStatusCodes } from "./Enums.ts";
import { Guard } from "./Guard.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { IPullRequestModel } from "./Models/IPullRequestModel.ts";

/**
 * Provides utility functions.
 */
export class Utils {
	private static readonly prodVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
	private static readonly prevVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$/;

	/**
	 * Checks if the value is numeric.
	 * @param value The value to check.
	 * @returns True if the value is numeric, otherwise false.
	 */
	public static isNumeric(value: string): boolean {
		const parsedValue = parseFloat(value);

		return !isNaN(parsedValue) && isFinite(parsedValue) && value === parsedValue.toString();
	}

	/**
	 * Prints the lines of text in a GitHub group.
	 * @param lines The lines of text to print.
	 */
	public static printInGroup(title: string, lines: string[]): void {
		console.log(`::group::${title}`);

		lines.forEach((line) => {
			console.log(line);
		});

		console.log("::endgroup::");
	}

	/**
	 * Checks if the value is null, undefined, or empty.
	 * @param value The value to check.
	 * @returns True if the value is null, undefined, or empty, otherwise false.
	 */
	public static isNullOrEmptyOrUndefined<T>(
		value: undefined | null | string | number | T[] | (() => T),
	): value is undefined | null | "" | number | T[] | (() => T) {
		if (value === undefined || value === null) {
			return true;
		}

		if (typeof value === "string") {
			return value === "";
		}

		if (Array.isArray(value)) {
			return value.length === 0;
		}

		return false;
	}

	/**
	 * Gets the name of the script that is running.
	 * @returns The name of the script that is running.
	 */
	public static getScriptName(): string {
		return Deno.mainModule.substring(Deno.mainModule.lastIndexOf("/") + 1);
	}

	/**
	 * Filters the given list of issues or pull requests to only return issues.
	 * @param issuesOrPrs The issues or pull requests to filter.
	 * @returns The issues from the given list of issues or pull requests.
	 */
	public static filterIssues(issuesOrPrs: (IIssueModel | IPullRequestModel)[]): IIssueModel[] {
		return <IIssueModel[]> issuesOrPrs.filter((item) => this.isIssue(item));
	}

	/**
	 * Filters the given list of issues or pull requests to only return pull requests.
	 * @param issuesOrPrs The issues or pull requests to filter.
	 * @returns The pull requests from the given list of issues or pull requests.
	 */
	public static filterPullRequests(issuesOrPrs: (IIssueModel | IPullRequestModel)[]): IPullRequestModel[] {
		return <IPullRequestModel[]> issuesOrPrs.filter((item) => this.isPr(item));
	}

	/**
	 * Returns a value indicating whether or not the given {@link issueOrPr} is an issue.
	 * @param issueOrPr The issue or pull request to check.
	 * @returns True if the given issue or pull request is an issue, otherwise false.
	 */
	public static isIssue(issueOrPr: IIssueModel | IPullRequestModel): issueOrPr is IIssueModel {
		return !("pull_request" in issueOrPr);
	}

	/**
	 * Returns a value indicating whether or not the given {@link issueOrPr} is a pull request.
	 * @param issueOrPr The issue or pull request to check.
	 * @returns True if the given issue or pull request is a pull request, otherwise false.
	 */
	public static isPr(issueOrPr: IPullRequestModel | IIssueModel): issueOrPr is IPullRequestModel {
		return "pull_request" in issueOrPr;
	}

	/**
	 * Prints the given {@link message} as a GitHub notice.
	 * @param message The message to print.
	 */
	public static printAsGitHubNotice(message: string): void {
		console.log(`::notice::${message}`);
	}

	/**
	 * Prints the given {@link message} as a GitHub error.
	 * @param message The message to print.
	 */
	public static printAsGitHubError(message: string): void {
		console.log(`::error::${message}`);
	}

	/**
	 * Prints the given {@link message} as a GitHub warning.
	 * @param message The message to print.
	 */
	public static printAsGitHubWarning(message: string): void {
		console.log(`::warning::${message}`);
	}

	/**
	 * Prints the given list of problems as errors.
	 * @param problems The list of problems to print.
	 * @param successMsg The message to print if there are no problems.
	 * @returns A promise that resolves if there are no problems, otherwise rejects with the list of problems.
	 */
	public static printProblemList(problems: string[], successMsg: string): void {
		const errorList: string[] = [];

		// Display all of the issues that have been found as errors
		for (let i = 0; i < problems.length; i++) {
			const errorFound = problems[i];

			errorList.push(`${i + 1}. ${errorFound}`);
		}

		if (errorList.length > 0) {
			console.log(`::group::${problems.length} problem(s) found.`);

			errorList.forEach((error) => {
				this.printAsGitHubError(error);
			});

			console.log("::endgroup::");
		} else {
			console.log(`✅No problems found!!✅\n${successMsg}`);
		}
	}

	/**
	 * Checks if the response contains status codes other than in the 200 range.
	 * If it does, it will print the error message and exit the process.
	 * @param response The response from a request.
	 */
	public static throwIfErrors(response: Response): void {
		if (response.status < GitHubHttpStatusCodes.OK) {
			const errorMsg = `There was a problem with the request. Status code: ${response.status}(${response.statusText}).`;

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
	}

	/**
	 * Checks if the given {@link version} is a valid production version.
	 * @param version The version to check.
	 * @returns True if the version is a valid production version, otherwise false.
	 */
	public static validProdVersion(version: string): boolean {
		return this.prodVersionRegex.test(version);
	}

	/**
	 * Checks if the given {@link version} is not valid production version.
	 * @param version The version to check.
	 * @returns True if the version is not a valid production version, otherwise false.
	 */
	public static isNotValidProdVersion(version: string): boolean {
		return !Utils.validProdVersion(version);
	}

	/**
	 * Checks if the given {@link version} is a valid preview version.
	 * @param version The version to check.
	 * @returns True if the version is a valid preview version, otherwise false.
	 */
	public static validPreviewVersion(version: string): boolean {
		return this.prevVersionRegex.test(version);
	}

	/**
	 * Checks if the given {@link version} is not a valid preview version.
	 * @param version The version to check.
	 * @returns True if the version is not a valid preview version, otherwise false.
	 */
	public static isNotValidPreviewVersion(version: string): boolean {
		return !Utils.validPreviewVersion(version);
	}

	/**
	 * Returns a number that is clamped between the given {@link min} and {@link max} values.
	 * @param value The value to clamp.
	 * @param min The minimum value.
	 * @param max The maximum value.
	 * @returns A value that is clamped between the given {@link min} and {@link max} values.
	 */
	public static clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	/**
	 * Builds a URL to an issue that matches the given {@link issueNumber} in a repository that with a
	 * name that matches the given {@link repoName} and is owned by the given {@link repoOwner}.
	 * @param repoOwner The owner of the repository.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @returns The URL to the issue.
	 */
	public static buildIssueUrl(repoOwner: string, repoName: string, issueNumber: number): string {
		const funcName = "buildIssueUrl";
		Guard.isNullOrEmptyOrUndefined(repoOwner, funcName, "repoOwner");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");
		Guard.isLessThanOne(issueNumber, funcName, "issueNumber");

		return `https://github.com/${repoOwner}/${repoName}/issues/${issueNumber}`;
	}

	/**
	 * Builds a URL to a pull request that matches the given {@link prNumber} in a repository with a
	 * name that matches the given {@link repoName} and is owned by the given {@link repoOwner}.
	 * @param repoOwner The owner of the repository.
	 * @param repoName The name of the repository.
	 * @param prNumber The pull request number.
	 * @returns The URL to the issue.
	 */
	public static buildPullRequestUrl(repoOwner: string, repoName: string, prNumber: number): string {
		const funcName = "buildPullRequestUrl";
		Guard.isNullOrEmptyOrUndefined(repoOwner, funcName, "repoOwner");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");
		Guard.isLessThanOne(prNumber, funcName, "prNumber");

		return `https://github.com/${repoOwner}/${repoName}/pull/${prNumber}`;
	}

	/**
	 * Builds a URL to the labels page of a repository with a name that matches the given {@link repoName}
	 * and is owned by the given {@link repoOwner}.
	 * @param repoOwner The owner of the repository.
	 * @param repoName The name of the repository.
	 * @returns The URL to the repository labels page.
	 */
	public static buildLabelsUrl(repoOwner: string, repoName: string): string {
		const funcName = "buildLabelsUrl";
		Guard.isNullOrEmptyOrUndefined(repoOwner, funcName, "repoOwner");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");

		return `https://github.com/${repoOwner}/${repoName}/labels`;
	}
}

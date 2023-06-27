import { GitHubHttpStatusCodes } from "./Enums.ts";
import { Guard } from "./Guard.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { ILabelModel } from "./Models/ILabelModel.ts";
import { IProjectModel } from "./Models/IProjectModel.ts";
import { IPullRequestModel } from "./Models/IPullRequestModel.ts";
import { IUserModel } from "./Models/IUserModel.ts";

/**
 * Provides utility functions.
 */
export class Utils {
	private static readonly prodVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
	private static readonly prevVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$/;
	private static readonly featureBranchRegex = /^feature\/[1-9][0-9]*-(?!-)[a-z-]+/gm;

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
	 * @param lineOrLines The lines of text to print.
	 */
	public static printInGroup(title: string, lineOrLines: string | string[]): void {
		console.log(`::group::${title}`);

		if (typeof lineOrLines === "string") {
			console.log(lineOrLines);
		} else {
			lineOrLines.forEach((line) => {
				console.log(line);
			});
		}

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
		Utils.printEmptyLine();
		console.log(`::notice::${message}`);
		Utils.printEmptyLine();
	}

	/**
	 * Prints the given {@link message} as a GitHub error.
	 * @param message The message to print.
	 */
	public static printAsGitHubError(message: string): void {
		Utils.printEmptyLine();
		console.log(`::error::${message}`);
		Utils.printEmptyLine();
	}

	/**
	 * Prints the given {@link message} as a GitHub warning.
	 * @param message The message to print.
	 */
	public static printAsGitHubWarning(message: string): void {
		Utils.printEmptyLine();
		console.log(`::warning::${message}`);
		Utils.printEmptyLine();
	}

	/**
	 * Prints the given list of problems as errors.
	 * @param problems The list of problems to print.
	 * @param successMsg The message to print if there are no problems.
	 * @param failureMsg The message to print if there are problems.
	 * @returns A promise that resolves if there are no problems, otherwise rejects with the list of problems.
	 */
	public static printProblemList(problems: string[], successMsg: string, failureMsg: string): void {
		const errorList: string[] = [];

		// Display all of the issues that have been found as errors
		for (let i = 0; i < problems.length; i++) {
			const errorFound = problems[i];

			errorList.push(`${i + 1}. ${errorFound}`);
		}

		if (errorList.length > 0) {
			Utils.printAsGitHubError(failureMsg);
			console.log(`::group::${errorList.length} problems found.`);

			errorList.forEach((error) => {
				this.printAsGitHubError(error);
			});

			console.log("::endgroup::");
		} else {
			Utils.printAsGitHubNotice(successMsg);
		}
	}

	/**
	 * Checks if the response contains status codes other than in the 200 range.
	 * If it does, it will print the error message and exit the process.
	 * @param response The response from a request.
	 */
	public static throwIfErrors(response: Response): void {
		if (response.status < GitHubHttpStatusCodes.OK) {
			const errorMsg = `There was a problem with the request. Error: ${response.status}(${response.statusText}).`;

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

	/**
	 * Returns a value indicating whether or not the assignees of the given {@link issue} and {@link pr} match.
	 * @param issue The issue to compare with the pull request.
	 * @param pr The pull request to compare with the issue.
	 * @returns True if the assignees of the given {@link issue} and {@link pr} match, otherwise false.
	 */
	public static assigneesMatch(issueAssignees: IUserModel[], prAssignees: IUserModel[]): boolean {
		if (issueAssignees.length === 0 && prAssignees.length === 0) {
			return true;
		}

		if (issueAssignees.length != prAssignees.length) {
			return false;
		}

		for (let i = 0; i < issueAssignees.length; i++) {
			if (issueAssignees[i].login != prAssignees[i].login) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Returns a value indicating whether or not the labels of the given {@link issue} and {@link pr} match.
	 * @param issue The issue to to compare with the pull request.
	 * @param pr The pull request to compare with the issue.
	 * @returns True if the labels of the issue and pull request match, otherwise false.
	 */
	public static labelsMatch(issueLabels: ILabelModel[], prLabels: ILabelModel[]): boolean {
		if (issueLabels.length === 0 && prLabels.length === 0) {
			return true;
		}

		if (issueLabels.length != prLabels.length) {
			return false;
		}

		for (let i = 0; i < issueLabels.length; i++) {
			if (issueLabels[i].name != prLabels[i].name) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Returns a value indicating whether or not the organizational projects of the given
	 * {@link issueProjects} and {@link prProjects} match.
	 * @param issueProjects The issue projects to to compare with the pull request projects.
	 * @param prProjects The pull request projects to compare with the issue projects.
	 * @returns True if the labels of the issue and pull request match, otherwise false.
	 */
	public static orgProjectsMatch(issueProjects: IProjectModel[], prProjects: IProjectModel[]): boolean {
		if (issueProjects.length === 0 && prProjects.length === 0) {
			return true;
		}

		if (issueProjects.length != prProjects.length) {
			return false;
		}

		for (let i = 0; i < issueProjects.length; i++) {
			if (issueProjects[i].number != prProjects[i].number) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Converts the given {@link number} to its ordinal representation.
	 * @param number The number to convert.
	 * @returns The ordinal representation of the given {@link number}.
	 */
	public static toOrdinal(number: number): string {
		const suffixes = ["th", "st", "nd", "rd"];
		const value = Math.abs(number) % 100;
		const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
	  
		return `${number}${suffix}`;
	}

	/**
	 * Prints an empty line to the console.
	 */
	public static printEmptyLine(): void {
		console.log();
	}

	/**
	 * Returns a value indicating whether or not the given {@link branchName} is a feature branch.
	 * @param branchName The name of the branch to check.
	 * @returns True if the given {@link branchName} is a feature branch, otherwise false.
	 */
	public static isFeatureBranch(branchName: string): boolean {
		return branchName.match(this.featureBranchRegex) != null;
	}

	/**
	 * Returns a value indicating whether or not the given {@link branchName} is a feature branch.
	 * @param branchName The name of the branch to check.
	 * @returns True if the given {@link branchName} is not a feature branch, otherwise false.
	 */
	public static isNotFeatureBranch(branchName: string): boolean {
		return !this.isFeatureBranch(branchName);
	}
}

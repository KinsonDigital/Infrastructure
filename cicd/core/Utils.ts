import { GitHubLogType } from "./Enums.ts";
import { printAsGitHubError, printAsGitHubNotice, printAsGitHubWarning } from "./github.ts";
import {
	IssueModel,
	LabelModel,
	ProjectModel,
	PullRequestModel,
	UserModel,
} from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github/models";
import { isLessThanOne } from "./guards.ts";

const prodVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)$/;
const prevVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)-preview\.([1-9]\d*|0)$/;
const featureBranchRegex = /^feature\/[1-9][0-9]*-(?!-)[a-z-]+/gm;

/**
 * Checks if the value is numeric.
 * @param value The value to check.
 * @returns True if the value is numeric, otherwise false.
 */
export function isNumeric(value: string): boolean {
	const parsedValue = parseFloat(value);

	return !isNaN(parsedValue) && isFinite(parsedValue) && value === parsedValue.toString();
}

/**
 * Prints the lines of text in a GitHub group.
 * @param lineOrLines The lines of text to print.
 */
export function printInGroup(title: string, lineOrLines: string | string[]): void {
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
export function isNothing<T>(
	value: undefined | null | string | number | boolean | T[] | (() => T) | object,
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
 * Filters the given list of issues or pull requests to only return issues.
 * @param issuesOrPrs The issues or pull requests to filter.
 * @returns The issues from the given list of issues or pull requests.
 */
export function filterIssues(issuesOrPrs: (IssueModel | PullRequestModel)[]): IssueModel[] {
	return <IssueModel[]>issuesOrPrs.filter((item) => isIssue(item));
}

/**
 * Filters the given list of issues or pull requests to only return pull requests.
 * @param issuesOrPrs The issues or pull requests to filter.
 * @returns The pull requests from the given list of issues or pull requests.
 */
export function filterPullRequests(issuesOrPrs: (IssueModel | PullRequestModel)[]): PullRequestModel[] {
	return <PullRequestModel[]>issuesOrPrs.filter((item) => isPr(item));
}

/**
 * Returns a value indicating whether or not the given {@link issueOrPr} is an issue.
 * @param issueOrPr The issue or pull request to check.
 * @returns True if the given issue or pull request is an issue, otherwise false.
 */
export function isIssue(issueOrPr: IssueModel | PullRequestModel): issueOrPr is IssueModel {
	return !("pull_request" in issueOrPr);
}

/**
 * Returns a value indicating whether or not the given {@link issueOrPr} is a pull request.
 * @param issueOrPr The issue or pull request to check.
 * @returns True if the given issue or pull request is a pull request, otherwise false.
 */
export function isPr(issueOrPr: PullRequestModel | IssueModel): issueOrPr is PullRequestModel {
	return "pull_request" in issueOrPr;
}

/**
 * Prints the given list of problems as errors.
 * @param problems The list of problems to print.
 * @param successMsg The message to print if there are no problems.
 * @param failureMsg The message to print if there are problems.
 * @returns A promise that resolves if there are no problems, otherwise rejects with the list of problems.
 */
export function printProblemList(problems: string[], successMsg: string, failureMsg: string): void {
	const errorList: string[] = [];

	// Create a numbered list of the problems
	for (let i = 0; i < problems.length; i++) {
		const errorFound = problems[i];

		errorList.push(`${i + 1}. ${errorFound}`);
	}

	if (errorList.length > 0) {
		printAsGitHubError(failureMsg);
		console.log(`::group::${errorList.length} problems found.`);

		errorList.forEach((error) => {
			printAsGitHubError(error);
		});

		console.log("::endgroup::");
	} else {
		printAsGitHubNotice(successMsg);
	}
}

/**
 * Adds sequential numbers to the given list of {@link items}.
 * @param items The items to number.
 * @returns The numbered items.
 */
export function numberItems(items: string[]): string[] {
	const result: string[] = [];

	for (let i = 0; i < items.length - 1; i++) {
		result.push(`${toOrdinal(i + 1)} ${items[i]}}`);
	}

	return result;
}

/**
 * Prints the given list of {@link items} as a numbered list with each item prefixed with the given {@link prefix},
 * and logged to the GitHub console based on the given {@link logType}.
 * @param prefix The prefix to use for each item.
 * @param items The items to print.
 * @param logType The type of logging to use.
 */
export function printAsNumberedList(prefix: string, items: string[], logType: GitHubLogType = GitHubLogType.normal): void {
	const argInfos: string[] = [];

	for (let i = 0; i < items.length - 1; i++) {
		argInfos.push(`${toOrdinal(i + 1)}${prefix}${items[i]}`);
	}

	argInfos.forEach((info) => {
		switch (logType) {
			case GitHubLogType.normal:
				console.log(info);
				break;
			case GitHubLogType.notice:
				printAsGitHubNotice(info);
				break;
			case GitHubLogType.warning:
				printAsGitHubWarning(info);
				break;
			case GitHubLogType.error:
				printAsGitHubError(info);
				break;
			default:
				console.log(info);
				break;
		}
	});
}

/**
 * Checks if the given {@link version} is a valid production version.
 * @param version The version to check.
 * @returns True if the version is a valid production version, otherwise false.
 */
export function isValidProdVersion(version: string): boolean {
	return prodVersionRegex.test(version.trim().toLowerCase());
}

/**
 * Checks if the given {@link version} is not valid production version.
 * @param version The version to check.
 * @returns True if the version is not a valid production version, otherwise false.
 */
export function isNotValidProdVersion(version: string): boolean {
	return !isValidProdVersion(version);
}

/**
 * Checks if the given {@link version} is a valid preview version.
 * @param version The version to check.
 * @returns True if the version is a valid preview version, otherwise false.
 */
export function isValidPreviewVersion(version: string): boolean {
	return prevVersionRegex.test(version.trim().toLowerCase());
}

/**
 * Checks if the given {@link version} is not a valid preview version.
 * @param version The version to check.
 * @returns True if the version is not a valid preview version, otherwise false.
 */
export function isNotValidPreviewVersion(version: string): boolean {
	return !isValidPreviewVersion(version);
}

/**
 * Returns a number that is clamped between the given {@link min} and {@link max} values.
 * @param value The value to clamp.
 * @param min The minimum value.
 * @param max The maximum value.
 * @returns A value that is clamped between the given {@link min} and {@link max} values.
 */
export function clamp(value: number, min: number, max: number): number {
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
export function buildIssueUrl(repoOwner: string, repoName: string, issueNumber: number): string {
	if (isNothing(repoOwner)) {
		throw new Error("repoOwner parameter cannot be null, undefined, or empty.");
	}

	if (isNothing(repoName)) {
		throw new Error("repoName parameter cannot be null, undefined, or empty.");
	}

	if (isLessThanOne(issueNumber)) {
		throw new Error("issueNumber parameter must be greater than 1.");
	}

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
export function buildPullRequestUrl(repoOwner: string, repoName: string, prNumber: number): string {
	if (isNothing(repoOwner)) {
		throw new Error("repoOwner parameter cannot be null, undefined, or empty.");
	}
	if (isNothing(repoName)) {
		throw new Error("repoOwner parameter cannot be null, undefined, or empty.");
	}

	if (isLessThanOne(prNumber)) {
		throw new Error("prNumber parameter must be greater than 1.");
	}

	return `https://github.com/${repoOwner}/${repoName}/pull/${prNumber}`;
}

/**
 * Builds a URL to the labels page of a repository with a name that matches the given {@link repoName}
 * and is owned by the given {@link repoOwner}.
 * @param repoOwner The owner of the repository.
 * @param repoName The name of the repository.
 * @returns The URL to the repository labels page.
 */
export function buildLabelsUrl(repoOwner: string, repoName: string): string {
	if (isNothing(repoOwner)) {
		throw new Error("repoOwner parameter cannot be null, undefined, or empty.");
	}
	if (isNothing(repoName)) {
		throw new Error("repoOwner parameter cannot be null, undefined, or empty.");
	}

	return `https://github.com/${repoOwner}/${repoName}/labels`;
}

/**
 * Returns a value indicating whether or not the assignees of the given {@link issue} and {@link pr} match.
 * @param issue The issue to compare with the pull request.
 * @param pr The pull request to compare with the issue.
 * @returns True if the assignees of the given {@link issue} and {@link pr} match, otherwise false.
 */
export function assigneesMatch(issueAssignees: UserModel[], prAssignees: UserModel[]): boolean {
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
export function labelsMatch(issueLabels: LabelModel[], prLabels: LabelModel[]): boolean {
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
export function orgProjectsMatch(issueProjects: ProjectModel[], prProjects: ProjectModel[]): boolean {
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
export function toOrdinal(number: number): string {
	const suffixes = ["th", "st", "nd", "rd"];
	const value = Math.abs(number) % 100;
	const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];

	return `${number}${suffix}`;
}

/**
 * Prints an empty line to the console.
 */
export function printEmptyLine(): void {
	console.log();
}

/**
 * Returns a value indicating whether or not the given {@link branchName} is a feature branch.
 * @param branchName The name of the branch to check.
 * @returns True if the given {@link branchName} is a feature branch, otherwise false.
 */
export function isFeatureBranch(branchName: string): boolean {
	return branchName.match(featureBranchRegex) != null;
}

/**
 * Returns a value indicating whether or not the given {@link branchName} is a feature branch.
 * @param branchName The name of the branch to check.
 * @returns True if the given {@link branchName} is not a feature branch, otherwise false.
 */
export function isNotFeatureBranch(branchName: string): boolean {
	return !isFeatureBranch(branchName);
}

/**
 * Converts the given {@link value} to a string with its first letter converted to upper case.
 * @param value The value to convert.
 * @returns The given {@link value} with its first letter converted to upper case.
 */
export function firstLetterToUpper(value: string): string {
	if (isNothing(value)) {
		return value;
	}

	const allButFirstLetter = value.slice(1);
	const firstLetter = value.slice(0, 1).toUpperCase();

	return `${firstLetter}${allButFirstLetter}`;
}

/**
 * Normalizes any endings in the given {@link value}.
 * @param value The value with line endings to normalize.
 * @returns The given {@link value} with normalized line endings.
 */
export function normalizeLineEndings(value: string): string {
	return value.indexOf("\\r\\n") === -1 ? value.replaceAll("\\r\\n", "\\n") : value;
}

/**
 * Trims all of the given {@link values}.
 * @param values The values to trim.
 * @returns The given {@link values} with all values trimmed.
 */
export function trimAll(values: string[]): string[] {
	const trimmedValues: string[] = [];

	values.forEach((value) => {
		trimmedValues.push(value.trim());
	});

	return trimmedValues;
}

/**
 * Removes any white space from the start of the given {@link value}.
 * @param value The value to remove the starting white space from.
 * @returns The given {@link value} with the starting white space removed.
 */
export function trimAllStartingWhiteSpace(value: string): string {
	if (isNothing(value)) {
		return value;
	}

	trimAllStartingValue(value, "");
	trimAllStartingValue(value, "\t");

	return value;
}

/**
 * Trims the given {@link valueToRemove} from the start of the given {@link valueToTrim}
 * until the {@link valueToRemove} does not exit anymore.
 * @param valueToTrim The value to trim the starting value from.
 * @param valueToRemove The starting value to trim.
 * @returns The given {@link valueToTrim} with the starting value trimmed.
 */
export function trimAllStartingValue(valueToTrim: string, valueToRemove: string): string {
	if (isNothing(valueToTrim)) {
		return valueToTrim;
	}

	if (isNothing(valueToRemove)) {
		return valueToTrim;
	}

	while (valueToTrim.startsWith(valueToRemove)) {
		valueToTrim = valueToTrim.slice(1);
	}

	return valueToTrim;
}

/**
 * Trims the given {@link valueToRemove} from the end of the given {@link valueToTrim}
 * until the {@link valueToRemove} does not exit anymore.
 * @param valueToTrim The value to trim the ending value from.
 * @param valueToRemove The ending value to trim.
 * @returns The given {@link valueToTrim} with the ending value trimmed.
 */
export function trimAllEndingValue(valueToTrim: string, valueToRemove: string): string {
	if (isNothing(valueToTrim)) {
		return valueToTrim;
	}

	if (isNothing(valueToRemove)) {
		return valueToTrim;
	}

	while (valueToTrim.endsWith(valueToRemove)) {
		valueToTrim = valueToTrim.slice(0, valueToTrim.length - 1);
	}

	return valueToTrim;
}

/**
 * Normalizes the given {@link path} by replacing all back slashes with forward slashes,
 * and trimming any and ending slashes.
 * @param path The path to normalize.
 * @returns The normalized path.
 */
export function normalizePath(path: string): string {
	path = path.replaceAll("\\", "/");
	path = path.replaceAll("//", "/");
	path = trimAllEndingValue(path, "/");

	return path;
}

/**
 * Splits the given {@link value} by the given {@link separator}.
 * @param value The value to split.
 * @param separator The separator to split the value by.
 * @returns The values split by the given separator.
 * @remarks Only the first character will be used by the given {@link separator}.
 */
export function splitBy(value: string, separator: string): string[] {
	if (isNothing(value)) {
		return [];
	}

	if (isNothing(separator)) {
		return [value];
	}

	// Only use the first character for a separator
	separator = separator.length === 1 ? separator : separator[0];

	return value.indexOf(separator) === -1 ? [value] : value.split(separator)
		.map((v) => v.trim())
		.filter((i) => !isNothing(i));
}

/**
 * Splits the given {@link value} by comma.
 * @param value The value to split by comma.
 * @returns The values split by comma.
 */
export function splitByComma(value: string): string[] {
	if (isNothing(value)) {
		return [];
	}

	return splitBy(value, ",");
}

/**
 * Trims the given path by removing any leading or trailing slashes or periods.
 * @param value The path to trim.
 * @returns The trimmed path.
 */
export function trimPathBothEnds(value: string) {
	const startWithDotRegex = /^\.+/gm;
	const startWithForwardSlashRegex = /^[\/\\]+/gm;
	const startWithBackSlashRegex = /^[\\]+/gm;
	const endsWithForwardSlashRegex = /[\/\\]+$/gm;
	const endsWithBackSlashRegex = /[\\]+$/gm;

	while (startWithDotRegex.test(value)) {
		value = value.replace(startWithDotRegex, "");
	}

	while (startWithForwardSlashRegex.test(value)) {
		value = value.replace(startWithForwardSlashRegex, "");
	}

	while (startWithBackSlashRegex.test(value)) {
		value = value.replace(startWithBackSlashRegex, "");
	}

	while (endsWithForwardSlashRegex.test(value)) {
		value = value.replace(endsWithForwardSlashRegex, "");
	}

	while (endsWithBackSlashRegex.test(value)) {
		value = value.replace(endsWithBackSlashRegex, "");
	}

	return value;
}

/**
 * Get the value of an environment variable after checking if it exists.
 * @param name The name of the environment variable.
 * @remarks This function will throw an error if the environment variable does not exist.
 */
export function getEnvVar(name: string, scriptFileName?: string, throwErrorIfMissing: boolean = true): string {
	const value = (Deno.env.get(name) ?? "").trim();

	if (isNothing(value) && throwErrorIfMissing) {
		const fileName = isNothing(scriptFileName) ? "" : `\n\t${scriptFileName}`;
		const errorMsg = `The '${name}' environment variable does not exist.${fileName}`;
		printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	return value;
}

import { File } from "../core/File.ts";
import { LabelClient } from "../clients/LabelClient.ts";
import { MilestoneClient } from "../clients/MilestoneClient.ts";
import { Utils } from "../core/Utils.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length < 3) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be the type of release.";
	errorMsg += "\n\tValid values are 'production' and 'preview' and are case-insensitive.";

	errorMsg += "\nThe 3rd arg is required and must be the version of the release.";
	errorMsg += "\nThe 4th arg is optional and must be a comma delimited list of labels for issues ignore.";
	errorMsg += "\n\tProviding no argument or empty will allow issues and prs with any label.";

	errorMsg += "\nThe 5th arg is optional and must be a label of a PR to enforce the PR to be in the release notes.";
	errorMsg += "\nThe 6th arg is optional and must be the GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const releaseType = Deno.args[1].trim().toLocaleLowerCase();
let version = Deno.args[2].trim().toLowerCase();
const ignoreLabelsArg = Deno.args.length >= 4 ? Deno.args[3].trim() : "";
const prLabel = Deno.args.length >= 5 ? Deno.args[4].trim() : "";
const token = Deno.args.length >= 6 ? Deno.args[5].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Release Type (Required): ${releaseType}`,
	`Version (Required): ${version}`,
	`Ignore Labels (Optional): ${ignoreLabelsArg}`,
	`PR Label (Optional): ${Utils.isNullOrEmptyOrUndefined(prLabel) ? "Not Provided" : prLabel}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

// Check the release type and make sure that it is all lowercase except the first letter
const allButFirstLetter = releaseType.slice(1).toLowerCase();
const firstLetter = releaseType.slice(0, 1).toUpperCase();
const releaseTypeTitle = `${firstLetter}${allButFirstLetter}`;

if (releaseTypeTitle != "Production" && releaseTypeTitle != "Preview") {
	Utils.printAsGitHubError(
		`The release type '${releaseTypeTitle}' is invalid.  It must be either 'Production' or 'Preview'.`,
	);
	Deno.exit(1);
}

// Make sure the version starts with a 'v'
version = version.startsWith("v") ? version : `v${version}`;

const ignoreLabels: string[] = Utils.isNullOrEmptyOrUndefined(ignoreLabelsArg)
	? []
	: ignoreLabelsArg.trim().split(",").map((label) => label.trim());

const noPRLabel = Utils.isNullOrEmptyOrUndefined(prLabel);
const prLabelGiven = !noPRLabel;

const problemsFound: string[] = [];

// Check that the label exists
if (prLabelGiven) {
	const labelClient: LabelClient = new LabelClient(token);
	const labelExists = await labelClient.labelExists(repoName, prLabel);

	if (!labelExists) {
		problemsFound.push(`The label '${prLabel}' does not exist in the repo '${repoName}'.`);
	}
}

const issueLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/issues\/[0-9]*\)/gm;
const prLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/pull\/[0-9]*\)/gm;
const title = new RegExp(`${repoName} ${releaseTypeTitle} Release Notes - ${version}`, "gm");

const ignoredIssues: IIssueModel[] = [];
const ignoredPullRequests: IPullRequestModel[] = [];
const ignoredItemList: string[] = [];

const milestoneClient = new MilestoneClient();

// Filter out any issues that have a label included in the ignore label list
const issues = (await milestoneClient.getIssues(repoName, version))
	.filter((issue: IIssueModel) => {
		if (ignoreLabels.length <= 0) {
			return true;
		}

		const shouldNotIgnore = ignoreLabels.every((ignoreLabel) =>
			issue.labels?.every((issueLabel) => issueLabel.name != ignoreLabel) ?? true
		);
		const shouldIgnore = !shouldNotIgnore;

		if (shouldIgnore) {
			ignoredIssues.push(issue);
		}

		return shouldNotIgnore;
	});

// Filter out any prs that have a label included in the ignore label list
const pullRequests = (await milestoneClient.getPullRequests(repoName, version))
	.filter((pr: IPullRequestModel) => {
		const shouldNotIgnore = ignoreLabels.length <= 0 || ignoreLabels.every((ignoreLabel) => {
			return pr.labels?.every((prLabel) => prLabel.name != ignoreLabel) ?? true;
		});
		const shouldIgnore = !shouldNotIgnore;

		if (shouldIgnore) {
			ignoredPullRequests.push(pr);
		}

		return (pr.pull_request?.merged_at != null && shouldNotIgnore) &&
			pr.labels?.some((label) => label.name === prLabel);
	});

if (ignoredIssues.length > 0) {
	ignoredIssues.forEach((issue) => {
		ignoredItemList.push(`${issue.title} - Issue #${issue.number}`);
	});

	ignoredPullRequests.forEach((pr) => {
		ignoredItemList.push(`${pr.title} - PR #${pr.number}`);
	});

	Utils.printInGroup("Ignored Issues And PRs", ignoredItemList);
}

const baseDirPath = Deno.cwd();
const notesDirName = releaseType === "production" ? "ProductionReleases" : "PreviewReleases";
const relativeDirPath = `Documentation/ReleaseNotes/${notesDirName}`;
const fileName = `Release-Notes-${version}.md`;
const fullFilePath = `${baseDirPath}/${relativeDirPath}/${fileName}`;

let pathInfo = "::group:: Release Notes File Path Info";
pathInfo += `\nBase Directory Path: ${baseDirPath}`;
pathInfo += `\nRelative Directory Path: ${relativeDirPath}`;
pathInfo += `\nFile Name: ${fileName}`;
pathInfo += `\nFull File Path: ${fullFilePath}`;
pathInfo += "\n::endgroup::";
console.log(pathInfo);

const releaseNoteFileData: string = File.LoadFile(fullFilePath);
const issueLinks: string[] = releaseNoteFileData.match(issueLinkRegex) ?? [];
const prLinks: string[] = noPRLabel ? [] : releaseNoteFileData.match(prLinkRegex) ?? [];

// If the title is incorrect, add to the list of errors found
if (releaseNoteFileData.match(title) === null) {
	problemsFound.push(
		`The title of the release notes is incorrect.  It should be '${releaseTypeTitle} ${releaseType} Release Notes - ${version}'.`,
	);
}

// Check that all of the issues exist in the release notes
issues.forEach((issue) => {
	const issueLink = `[#${issue.number}](${issue.html_url})`;

	if (!issueLinks.includes(issueLink)) {
		problemsFound.push(`The issue link for issue '${issue.number}' does not exist in the release notes.`);
	}
});

pullRequests.forEach((pr) => {
	const prLink = `[#${pr.number}](${pr.html_url})`;

	if (!prLinks.includes(prLink)) {
		problemsFound.push(
			`The pr link for issue '${pr.number}' with the label '${prLabel}' does not exist in the release notes.`,
		);
	}
});

Utils.printProblemList(problemsFound, `The release notes for version '${version}' are valid!!`);

if (problemsFound.length > 0) {
	Deno.exit(1);
}

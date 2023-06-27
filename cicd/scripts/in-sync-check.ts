import { IssueClient } from "../clients/IssueClient.ts";
import { ProjectClient } from "../clients/ProjectClient.ts";
import { PullRequestClient } from "../clients/PullRequestClient.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IProjectModel } from "../core/Models/IProjectModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length < 3) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a GitHub user.";
	errorMsg += "\nThe 3rd arg is required and must be pull request number.";
	errorMsg += "\nThe 4th arg is required and must be a GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const defaultReviewer = Deno.args[1].trim();
const prNumberStr = Deno.args[2].trim();
const githubToken = Deno.args[3].trim();

if (!(Utils.isNumeric(prNumberStr))) {
	Utils.printAsGitHubError(`The pull request number '${prNumberStr}' is not a valid number.`);
	Deno.exit(1);
}

const prNumber = Number.parseInt(prNumberStr);

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Default Reviewer (Required): ${defaultReviewer}`,
	`Pull Request Number (Required): ${prNumber}`,
	`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(githubToken) ? "Not Provided" : "****"}`,
]);

const prClient: PullRequestClient = new PullRequestClient(githubToken);
const projClient: ProjectClient = new ProjectClient(githubToken);

const featureBranchRegex = /^feature\/[1-9]+-(?!-)[a-z-]+$/gm;
const pr: IPullRequestModel = await prClient.getPullRequest(repoName, prNumber);

const headBranchNotValid = pr.head.ref.match(featureBranchRegex) === null;

// If the head branch is not a preview branch, no sync check is required. Just exit.
if (headBranchNotValid) {
	let noticeMsg = `The head branch '${pr.head.ref}' is not a feature branch.`;
	noticeMsg += "\nNo sync check is required.";

	Utils.printAsGitHubNotice(noticeMsg);
	Deno.exit(0);
}

const issueNumber = Number.parseInt((<RegExpMatchArray> pr.head.ref.match(/[0-9]+/gm))[0]);

const issueClient: IssueClient = new IssueClient(githubToken);
const issue: IIssueModel = await issueClient.getIssue(repoName, issueNumber);

const issueProjects: IProjectModel[] = await projClient.getIssueProjects(repoName, issueNumber);
const prProjects: IProjectModel[] = await projClient.getPullRequestProjects(repoName, prNumber);

const baseBranchNotValid = pr.base.ref != "master" && pr.base.ref != "preview";
const titleNotInSync = pr.title?.trim() != issue.title?.trim();
const defaultReviewerIsNotValid = !pr.requested_reviewers.some((r) => r.login === defaultReviewer);

const assigneesNotInSync = !Utils.assigneesMatch(issue, pr);
const labelsNotInSync = !Utils.labelsMatch(issue, pr);

const milestoneNotInSync = issue.milestone?.number != pr.milestone?.number;
const projectsNotInSync = !Utils.orgProjectsMatch(issueProjects, prProjects);

const problemsFound: string[] = [];

if (headBranchNotValid) {
	problemsFound.push(`The head branch '${pr.head.ref}' is not a valid feature branch.`);
}

if (baseBranchNotValid) {
	problemsFound.push(`The base branch '${pr.base.ref}' is not a valid base branch.`);
}

if (titleNotInSync) {
	problemsFound.push(`The pr title '${pr.title}' does not match with the issue title '${issue.title}'.`);
}

if (defaultReviewerIsNotValid) {
	problemsFound.push(`The pr default reviewer '${defaultReviewer}' is not valid or set.`);
}

if (assigneesNotInSync) {
	problemsFound.push(`The pr assignees do not match the issue assignees.`);
}

if (labelsNotInSync) {
	problemsFound.push(`The pr labels do not match the issue labels.`);
}

if (milestoneNotInSync) {
	problemsFound.push(`The pr milestone does not match the issue milestone.`);
}

if (projectsNotInSync) {
	problemsFound.push(`The pr projects do not match the issue projects.`);
}

// Print errors if any problems exist or a success message if no problems exist
let successMsg = `✅Pull request '${prNumber}' is in sync with the issue '${issue.number}'!!✅`;
successMsg += `\n\tIssue: ${issue.html_url}`;
successMsg += `\n\tPR: ${pr.html_url}`;

Utils.printProblemList(problemsFound, successMsg);

if (problemsFound.length > 0) {
	Deno.exit(1);
}

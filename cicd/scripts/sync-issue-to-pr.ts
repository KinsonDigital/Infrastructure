import { IssueClient } from "../clients/IssueClient.ts";
import { ProjectClient } from "../clients/ProjectClient.ts";
import { PullRequestClient } from "../clients/PullRequestClient.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { UsersClient } from "../clients/UsersClient.ts";
import { IssueState } from "../core/Enums.ts";
import { IIssueOrPRRequestData } from "../core/IIssueOrPRRequestData.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IProjectModel } from "../core/Models/IProjectModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { PRTemplateManager } from "../core/PRTemplateManager.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 5) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid pull request number.";
	errorMsg += "\nThe 3rd arg is required and must be a valid GitHub user.";
	errorMsg +=
		"\nThe 4th arg is required and must be a valid relative file path to the pull request sync template in a repository.";
	errorMsg += "\nThe 5th arg is required and must be a valid GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const prNumberStr = Deno.args[1].trim();
const defaultReviewer = Deno.args[2].trim();
let relativeTemplateFilePath = Deno.args[3].trim();
const githubToken = Deno.args[4].trim();

if (!(Utils.isNumeric(prNumberStr))) {
	Utils.printAsGitHubError(`The pull request number '${prNumberStr}' is not a valid number.`);
	Deno.exit(1);
}

const prNumber = Number.parseInt(prNumberStr);

// Make sure that there are no backslashes and that it does not start with a forward slash
relativeTemplateFilePath = relativeTemplateFilePath.replaceAll("\\", "/");
relativeTemplateFilePath = relativeTemplateFilePath.replaceAll("//", "/");
relativeTemplateFilePath = relativeTemplateFilePath.startsWith("/")
	? relativeTemplateFilePath.substring(1)
	: relativeTemplateFilePath;

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Pull Request Number (Required): ${prNumber}`,
	`Default Reviewer (Required): ${defaultReviewer}`,
	`Relative Template File Path (Optional): ${relativeTemplateFilePath}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(githubToken) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(githubToken);

const repoDoesNotExist = !(await repoClient.repoExists(repoName));
if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const prClient: PullRequestClient = new PullRequestClient(githubToken);

const prDoesNotExist = !(await prClient.pullRequestExists(repoName, prNumber));
if (prDoesNotExist) {
	Utils.printAsGitHubError(`A pull request with the number '${prNumber}' does not exist.`);
	Deno.exit(1);
}

const userClient: UsersClient = new UsersClient(githubToken);

const userDoesNotExist = !(await userClient.userExists(defaultReviewer));
if (userDoesNotExist) {
	Utils.printAsGitHubError(`The user '${defaultReviewer}' does not exist.`);
	Deno.exit(1);
}

const templateFileDoesNotExist = !(await repoClient.fileExists(repoName, relativeTemplateFilePath));
if (templateFileDoesNotExist) {
	Utils.printAsGitHubError(`The template file '${relativeTemplateFilePath}' does not exist in the repository '${repoName}.`);
	Deno.exit(1);
}

const pr: IPullRequestModel = await prClient.getPullRequest(repoName, prNumber);

const featureBranchRegex = /^feature\/[1-9]+-(?!-)[a-z-]+$/gm;
const headBranch = pr.head.ref;

// If the branch is not a feature branch, exit
// We do not want to sync a pull request for a branch that is not a feature branch
if (!featureBranchRegex.test(headBranch)) {
	Utils.printAsGitHubError(`The head branch '${headBranch}' is not a feature branch.`);
	Deno.exit(1);
}

const issueNumberStr = headBranch.replace("feature/", "").split("-")[0];
const issueNumber = parseInt(issueNumberStr);

const issueClient: IssueClient = new IssueClient(githubToken);

const issueNumDoesNotExist = !(await issueClient.openIssueExists(repoName, issueNumber));

if (issueNumDoesNotExist) {
	Utils.printAsGitHubError(`The issue number '#${issueNumber}' in the head branch '${headBranch}' does not exist.`);
	Deno.exit(1);
}

const issue: IIssueModel = await issueClient.getIssue(repoName, issueNumber);

const issueLabels = issue.labels?.map((label) => label.name) ?? [];

const projectClient: ProjectClient = new ProjectClient(githubToken);
const issueProjects: IProjectModel[] = await projectClient.getIssueProjects(repoName, issueNumber);

const prTemplate = new PRTemplateManager();
let prDescription = await prTemplate.getPullRequestTemplate(repoName, relativeTemplateFilePath);

// Find all issue template vars and replace them with the issue number
prDescription = prTemplate.updateIssueVar(prDescription, issueNumber);

// If the title does not match, sync the title
const prData: IIssueOrPRRequestData = {
	title: issue.title !== pr.title ? issue.title ?? "" : pr.title ?? "",
	body: prDescription,
	state: pr.state as IssueState,
	state_reason: null,
	milestone: issue.milestone?.number ?? null,
	labels: issueLabels,
	assignees: issue.assignees?.map((i) => i.login) ?? [],
};

await prClient.updatePullRequest(repoName, prNumber, prData);

await prClient.requestReviewer(repoName, prNumber, defaultReviewer);

// Add all of the issue org projects to the PR
for (let i = 0; i < issueProjects.length; i++) {
	const proj = issueProjects[i];

	if (pr.node_id === undefined) {
		continue;
	}

	await projectClient.addToProject(pr.node_id, proj.title);
}

// Update the description of the issue to include metadata about the pr number
const metadata = `\n\n<!--closed-by-pr:${prNumber}-->`;

const issueData: IIssueOrPRRequestData = {
	body: issue.body += metadata,
};

await issueClient.updateIssue(repoName, issueNumber, issueData);

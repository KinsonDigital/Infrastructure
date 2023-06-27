import { IssueClient } from "../clients/IssueClient.ts";
import { OrgClient } from "../clients/OrgClient.ts";
import { ProjectClient } from "../clients/ProjectClient.ts";
import { PullRequestClient } from "../clients/PullRequestClient.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { UsersClient } from "../clients/UsersClient.ts";
import { IssueState } from "../core/Enums.ts";
import { IIssueOrPRRequestData } from "../core/IIssueOrPRRequestData.ts";
import { IPRTemplateSettings } from "../core/IPRTemplateSettings.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IProjectModel } from "../core/Models/IProjectModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { PRTemplateManager } from "../core/PRTemplateManager.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 8) {
	let errorMsg = `The '${scriptName}' cicd script must have at 8 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be a valid organization name.";
	errorMsg += "\nThe 2nd arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 3rd arg is required and must be a valid GitHub user that has requested this script to run.";
	errorMsg += "\nThe 4th arg is required and must be a valid pull request number.";
	errorMsg += "\nThe 5th arg is required and must be a text that contains a sync command.";
	errorMsg += "\nThe 6th arg is required and must be a valid GitHub user.";
	errorMsg += "\nThe 7th arg is required and must be a valid relative file path";
	errorMsg += " to the pull request sync template in a repository.";
	errorMsg += "\nThe 8th arg is required and must be a valid GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const organizationName = Deno.args[0].trim();
const repoName = Deno.args[1].trim();
const requestedByUser = Deno.args[2].trim();
const prNumberStr = Deno.args[3].trim();
const syncCommand = Deno.args[4].trim();
const defaultReviewer = Deno.args[5].trim();
let relativeTemplateFilePath = Deno.args[6].trim();
const githubToken = Deno.args[7].trim();

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
Utils.printInGroup("Script Arguments", [
	`Organization Name (Required): ${organizationName}`,
	`Repo Name (Required): ${repoName}`,
	`Requested By User (Required): ${requestedByUser}`,
	`Pull Request Number (Required): ${prNumber}`,
	`Sync Command (Required): ${syncCommand}`,
	`Default Reviewer (Required): ${defaultReviewer}`,
	`Relative Template File Path (Required): ${relativeTemplateFilePath}`,
	`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(githubToken) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(githubToken);

const repoDoesNotExist = !(await repoClient.repoExists(repoName));
if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const prClient: PullRequestClient = new PullRequestClient(githubToken);
const issueClient: IssueClient = new IssueClient(githubToken);

const isRunSyncCommand = syncCommand.match(/\[run-sync\]/gm) != undefined;
const isInitialSyncCommand = syncCommand.match(/\[initial-sync\]/gm) != undefined;

// Validate that the comment contains the sync command
if (!isRunSyncCommand && !isInitialSyncCommand) {
	Utils.printAsGitHubNotice("Sync ignored.  The comment does not contain the '[run-sync]' or '[initial-sync]' sync command.");
	Deno.exit(0);
}

if (await issueClient.issueExists(repoName, prNumber)) {
	let ignoreMsg = `Sync ignored.  The pull request number is actually an issue number.`;
	ignoreMsg = "\nThis occurs when the '[run-sync]' command is used in an issue comment.";
	ignoreMsg += "\nThis command only works in pull request comments.";

	Utils.printAsGitHubNotice(ignoreMsg);
	Deno.exit(0);
}

const userClient: UsersClient = new UsersClient(githubToken);

const defaultReviewerDoesNotExist = !(await userClient.userExists(defaultReviewer));
if (defaultReviewerDoesNotExist) {
	Utils.printAsGitHubError(`The default reviewer '${defaultReviewer}' does not exist.`);
	Deno.exit(1);
}

const requestedByUserDoesNotExist = !(await userClient.userExists(requestedByUser));
if (requestedByUserDoesNotExist) {
	Utils.printAsGitHubError(`The requested by user '${requestedByUser}' does not exist.`);
	Deno.exit(1);
}

const orgClient: OrgClient = new OrgClient(githubToken);

const userIsNotOrgMember = !(await orgClient.userIsOrgAdminMember(organizationName, requestedByUser));

if (userIsNotOrgMember) {
	let errorMsg = `The user '${requestedByUser}' is not member of the`;
	errorMsg += ` organization '${organizationName}' with the admin role.`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(0);
}

const prTemplate = new PRTemplateManager();
let pr: IPullRequestModel = await prClient.getPullRequest(repoName, prNumber);

const prDoesNotExist = !(await prClient.pullRequestExists(repoName, prNumber));
if (prDoesNotExist) {
	Utils.printAsGitHubError(`A pull request with the number '${prNumber}' does not exist.`);
	Deno.exit(1);
} else {
	// Check if syncing is disabled but only if a [run-sync] command
	if (isRunSyncCommand && prTemplate.syncingDisabled(pr.body)) {
		Utils.printAsGitHubNotice("Syncing is disabled.  Syncing will not occur.");
		Deno.exit(0);
	}
}

const templateFileDoesNotExist = !(await repoClient.fileExists(repoName, relativeTemplateFilePath));
if (templateFileDoesNotExist) {
	Utils.printAsGitHubError(`The template file '${relativeTemplateFilePath}' does not exist in the repository '${repoName}.`);
	Deno.exit(1);
}

const headBranch = pr.head.ref;

// If the branch is not a feature branch, exit
// We do not want to sync a pull request for a branch that is not a feature branch
if (Utils.isNotFeatureBranch(headBranch)) {
	Utils.printAsGitHubError(`The head branch '${headBranch}' is not a feature branch.`);
	Deno.exit(1);
}

const issueNumberStr = headBranch.replace("feature/", "").split("-")[0];
const issueNumber = parseInt(issueNumberStr);

const issueDoesNotExist = !(await issueClient.openIssueExists(repoName, issueNumber));

if (issueDoesNotExist) {
	Utils.printAsGitHubError(`An issue with the number '#${issueNumber}' from the head branch '${headBranch}' does not exist.`);
	Deno.exit(1);
}

const issue: IIssueModel = await issueClient.getIssue(repoName, issueNumber);

const issueLabels = issue.labels?.map((label) => label.name) ?? [];

const projectClient: ProjectClient = new ProjectClient(githubToken);
const issueProjects: IProjectModel[] = await projectClient.getIssueProjects(repoName, issueNumber);

// If the pr body is not a valid pr template, load a new one to replace it.
const prDescription = isInitialSyncCommand || !prTemplate.isPRSyncTemplate(pr.body)
	? await prTemplate.getPullRequestTemplate(repoName, relativeTemplateFilePath, issueNumber)
	: pr.body;

// If the title does not match, sync the title
const prData: IIssueOrPRRequestData = {
	title: issue.title,
	body: prDescription,
	state: pr.state as IssueState,
	state_reason: null,
	milestone: issue.milestone?.number ?? null,
	labels: issueLabels,
	assignees: issue.assignees?.map((i) => i.login) ?? [],
};

await prClient.updatePullRequest(repoName, prNumber, prData);
pr = await prClient.getPullRequest(repoName, prNumber);

await prClient.requestReviewer(repoName, prNumber, defaultReviewer);

// Add all of the issue org projects to the PR
for (let i = 0; i < issueProjects.length; i++) {
	const proj = issueProjects[i];

	if (pr.node_id === undefined) {
		continue;
	}

	await projectClient.addToProject(pr.node_id, proj.title);
	Utils.printAsGitHubNotice(`The pr '${prNumber}' has been added to the same project as issue '${issueNumber}'.`);
}

const prMetaDataRegex = /<!--closed-by-pr:[0-9]+-->/gm;
const prMetaDataMatches = issue.body.match(prMetaDataRegex);
const prMetaDataExists = prMetaDataMatches != null && prMetaDataMatches.length > 0;

const prMetaData = `<!--closed-by-pr:${prNumber}-->`;
const issueBody = prMetaDataExists ? issue.body.replace(prMetaDataRegex, prMetaData) : issue.body + `\n\n${prMetaData}`;

// Update the description of the issue to include metadata about the pr number
const issueData: IIssueOrPRRequestData = {
	body: issueBody,
};

await issueClient.updateIssue(repoName, issueNumber, issueData);

const subText = prMetaDataExists ? "updated in" : "added to";
Utils.printAsGitHubNotice(`PR link metadata ${subText} the description of issue '${issueNumber}'.`);

const prProjects: IProjectModel[] = await projectClient.getPullRequestProjects(repoName, prNumber);

const syncSettings: IPRTemplateSettings = {
	issueNumber: issueNumber,
	headBranchValid: Utils.isFeatureBranch(pr.head.ref),
	baseBranchValid: pr.base.ref === "master" || pr.base.ref === "preview",
	issueNumValid: true,
	titleInSync: pr?.title === issue?.title,
	defaultReviewerValid: true,
	assigneesInSync: Utils.assigneesMatch(issue.assignees, pr.assignees),
	labelsInSync: Utils.labelsMatch(issue.labels, pr.labels),
	projectsInSync: Utils.orgProjectsMatch(issueProjects, prProjects),
	milestoneInSync: pr.milestone?.number === issue.milestone?.number,
};

const newPRSyncBody = prTemplate.processSyncTemplate(prDescription, syncSettings);

const syncPRData: IIssueOrPRRequestData = {
	title: issue.title,
	body: newPRSyncBody,
	state: pr.state as IssueState,
	state_reason: null,
	milestone: issue.milestone?.number ?? null,
	labels: issueLabels,
	assignees: issue.assignees?.map((i) => i.login) ?? [],
};

await prClient.updatePullRequest(repoName, prNumber, syncPRData);

import { ProjectClient } from "../clients/ProjectClient.ts";
import { PullRequestClient } from "../clients/PullRequestClient.ts";
import { IIssueOrPRRequestData } from "../core/IIssueOrPRRequestData.ts";
import { IPRTemplateSettings } from "../core/IPRTemplateSettings.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IProjectModel } from "../core/Models/IProjectModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { PRTemplateManager } from "../core/PRTemplateManager.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 4) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a GitHub user.";
	errorMsg += "\nThe 3rd arg is required and must be valid and parsable issue JSON data.";
	errorMsg += "\nThe 4th arg is required and must be a GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const defaultReviewer = Deno.args[1].trim();
const eventJsonData = Deno.args[2].trim(); // This can be sent in from a workflow using '${{ github.event.issue }}'
const githubToken = Deno.args[3].trim();

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Default Reviewer (Required): ${defaultReviewer}`,
	`Issue Event JSON Data (Required): ${eventJsonData}`,
	`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(githubToken) ? "Not Provided" : "****"}`,
]);

const closedByPRRegex = /<!--closed-by-pr:[0-9]+-->/gm;
const issue: IIssueModel = JSON.parse(eventJsonData);
const issueDescription = issue.body;

const prLinkMetaData = issueDescription.match(closedByPRRegex);

// If the issue does not contain the PR link metadata, no pull request stats syncing
// not required.
if (prLinkMetaData == null) {
	let noticeMsg = `The issue '${issue.number}' does not contain any pull request sync metadata.`;
	noticeMsg += `\n\tPR: ${issue.html_url}`;

	Utils.printAsGitHubNotice(noticeMsg);
	Deno.exit(0);
}

const prNumber = Number.parseInt((<RegExpMatchArray> prLinkMetaData[0].match(/[0-9]+/gm))[0]);

const prClient: PullRequestClient = new PullRequestClient(githubToken);
const projClient: ProjectClient = new ProjectClient(githubToken);

const issueProj: IProjectModel[] = await projClient.getIssueProjects(repoName, issue.number);
const prProj: IProjectModel[] = await projClient.getPullRequestProjects(repoName, prNumber);

const pr: IPullRequestModel = await prClient.getPullRequest(repoName, prNumber);

const featureBranchRegex = /^feature\/[1-9]+-(?!-)[a-z-]+$/gm;
const headBranchIsValid = pr.head.ref.match(featureBranchRegex) != null;
const baseBranchIsValid = pr.base.ref === "master" || pr.base.ref === "preview";
const titleInSync = pr.title === issue.title;
const defaultReviewerIsValid = pr.requested_reviewers.some((r) => r.login === defaultReviewer);

const assigneesInSync = Utils.assigneesMatch(issue, pr);
const labelsInSync = Utils.labelsMatch(issue, pr);

const milestoneInSync = issue.milestone === null && pr.milestone === null ||
	issue.milestone?.number === pr.milestone?.number;
const projectsInSync = issueProj.length === prProj.length &&
	issueProj.every((proj) => prProj.some((prProj) => prProj.number === proj.number));

const templateSettings: IPRTemplateSettings = {
	issueNumber: issue.number,
	headBranchValid: headBranchIsValid,
	baseBranchValid: baseBranchIsValid,
	issueNumValid: true,
	titleInSync: titleInSync,
	defaultReviewerValid: defaultReviewerIsValid,
	assigneesInSync: assigneesInSync,
	labelsInSync: labelsInSync,
	projectsInSync: projectsInSync,
	milestoneInSync: milestoneInSync,
};

const prTemplateManager = new PRTemplateManager();

const updatedPRDescription = prTemplateManager.processSyncTemplate(pr.body, templateSettings);

const prRequestData: IIssueOrPRRequestData = {
	body: updatedPRDescription,
};

await prClient.updatePullRequest(repoName, prNumber, prRequestData);

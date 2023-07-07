import { MilestoneClient } from "../clients/MilestoneClient.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length < 2) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 2 arguments with an additional 1 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be the title of the milestone.";
	errorMsg += "\nThe 3rd arg is optional and must be a GitHub PAT (Personal Access Token).";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

// TODO: Fix all of these args
const repoName = Deno.args[0].trim();
const milestoneTitle = Deno.args[1].trim();
const token = Deno.args.length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Milestone Title (Required): ${milestoneTitle}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(token);
const milestoneItems = await milestoneClient.getIssuesAndPullRequests(repoName, milestoneTitle);

const issues: IIssueModel[] = Utils.filterIssues(milestoneItems);
const prs: IPullRequestModel[] = Utils.filterPullRequests(milestoneItems);

const problemsFound: string[] = [];

// Find all issues that are not closed
issues.forEach((issue) => {
	if (issue.state != "closed") {
		problemsFound.push(`Issue #${issue.number} is not closed.\n\t${issue.html_url}`);
	}
});

// Find all pull requests that are not closed
prs.forEach((pr) => {
	if (pr.state != "closed") {
		problemsFound.push(`Pull request #${pr.number} is not closed.\n\t${pr.html_url}`);
	}
});

// Find all pull requests that are still in draft
prs.forEach((pr) => {
	if (pr.draft === true) {
		problemsFound.push(`Pull request #${pr.number} is still in draft.\n${pr.html_url}`);
	}
});

let successMsg = `✅All issues and pull requests in milestone '${milestoneTitle}' are`;
successMsg += " closed and no pull requests are in draft.✅";

const failureMsg = `❌Something went wrong with closing all of the issues for milestone '${milestoneTitle}'.❌`;

Utils.printProblemList(problemsFound, successMsg, failureMsg);

if (problemsFound.length > 0) {
	Deno.exit(1);
}

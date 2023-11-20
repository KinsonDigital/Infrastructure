import { MilestoneClient, RepoClient } from "../../deps.ts";
import { IssueModel, PullRequestModel } from "../../deps.ts";
import { Utils } from "../core/Utils.ts";

if (Deno.args.length != 3) {
	let errorMsg = `The cicd script must have at 4 arguments but has ${Deno.args.length} argument(s).`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repository owner name.";
	errorMsg += "\nThe 2nd arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 3rd arg is required and must be the title of the milestone.";
	errorMsg += "\nThe 4th arg is required and must be a GitHub PAT (Personal Access Token).";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

// TODO: Fix all of these args
const ownerName = Deno.args[0].trim();
const repoName = Deno.args[1].trim();
const milestoneTitle = Deno.args[2].trim();
const token = Deno.args.length >= 4 ? Deno.args[3].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Milestone Title (Required): ${milestoneTitle}`,
	`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
const repoDoesNotExist = !(await repoClient.exists());

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(ownerName, repoName, token);
const milestoneItems = await milestoneClient.getIssuesAndPullRequests(milestoneTitle);

const issues: IssueModel[] = Utils.filterIssues(milestoneItems);
const prs: PullRequestModel[] = Utils.filterPullRequests(milestoneItems);

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

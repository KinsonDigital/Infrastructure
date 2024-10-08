import { MilestoneClient, RepoClient } from "../../deps.ts";
import { IssueModel, PullRequestModel } from "../../deps.ts";
import getEnvVar from "../core/GetEnvVar.ts";
import { Utils } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const milestoneTitle = getEnvVar("MILESTONE_TITLE", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

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

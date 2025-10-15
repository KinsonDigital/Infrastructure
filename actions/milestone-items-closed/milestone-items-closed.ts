import { MilestoneClient, RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { IssueModel, PullRequestModel } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github/models";
import { printAsGitHubError, setGitHubOutput } from "../../cicd/core/github.ts";
import { getEnvVar, filterIssues, filterPullRequests, printProblemList } from "../../cicd/core/Utils.ts";
import { validateOrgExists, validateRepoExists } from "../../cicd/core/Validators.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const milestoneName = getEnvVar("MILESTONE_NAME", scriptFileName);
const failIfAllItemsNotClosed = getEnvVar("FAIL_IF_ALL_ITEMS_NOT_CLOSED", scriptFileName).toLowerCase() === "true";
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

await validateOrgExists(ownerName, token);
await validateRepoExists(ownerName, repoName, token);

const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
const repoDoesNotExist = !(await repoClient.exists());

if (repoDoesNotExist) {
	printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(ownerName, repoName, token);
const milestoneItems = await milestoneClient.getIssuesAndPullRequests(milestoneName);

const issues: IssueModel[] = filterIssues(milestoneItems);
const prs: PullRequestModel[] = filterPullRequests(milestoneItems);

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

const problemsExist = problemsFound.length > 0;

// Set the output variable
setGitHubOutput("all-items-closed", problemsExist ? "true" : "false");

if (failIfAllItemsNotClosed && problemsExist) {
	let successMsg = `✅All issues and pull requests in milestone '${milestoneName}' are`;
	successMsg += " closed and no pull requests are in draft.✅";

	const failureMsg = `❌Something went wrong with closing all of the issues for milestone '${milestoneName}'.❌`;

	printProblemList(problemsFound, successMsg, failureMsg);

	if (problemsFound.length > 0) {
		Deno.exit(1);
	}
}

import { ProjectClient, IssueClient, PullRequestClient } from "../../deps.ts";
import getEnvVar from "../core/GetEnvVar.ts";
import { Utils } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("REPO_OWNER", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);
const projectName = getEnvVar("PROJECT_NAME", scriptFileName);
const issueOrPrNumberStr = getEnvVar("ISSUE_OR_PR_NUMBER", scriptFileName);

const projectClient = new ProjectClient(ownerName, repoName, token);
const issueClient = new IssueClient(ownerName, repoName, token);
const prClient = new PullRequestClient(ownerName, repoName, token);

const issueOrPrNumber = parseInt(issueOrPrNumberStr);

const isIssueNumber = await issueClient.issueExists(issueOrPrNumber);
const isPRNumber = await prClient.pullRequestExists(issueOrPrNumber);

if (isIssueNumber && !isPRNumber) {
	await projectClient.addIssueToProject(issueOrPrNumber, projectName);
} else if (!isIssueNumber && isPRNumber) {
	await projectClient.addPullRequestToProject(issueOrPrNumber, projectName);
} else {
	const errorMsg = `Could not distinguish between the issue or pull request number '${issueOrPrNumber}'.`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const itemType = isIssueNumber && !isPRNumber ? "issue" : "pull request";

Utils.printAsGitHubNotice(`The ${itemType} has been added to the ${projectName} project.`);

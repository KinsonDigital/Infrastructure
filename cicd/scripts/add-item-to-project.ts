import { IssueClient } from "../clients/IssueClient.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { ProjectClient } from "../clients/ProjectClient.ts";
import { PullRequestClient } from "../clients/PullRequestClient.ts";
import { Utils } from "../core/Utils.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { ItemType } from "../core/Types.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 5) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid issue or pr number.";
	errorMsg += "\nThe 3rd arg is required and must be a either the value 'issue' or 'pull-request' for the item type.";
	errorMsg += "\nThe 4th arg is required and must be a valid GitHub organization project.";
	errorMsg += "\nThe 5th arg is required and must be a valid GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const issueOrPRNumber = Utils.isNumeric(Deno.args[1].trim()) ? parseInt(Deno.args[1].trim()) : -1;
const itemType: ItemType = <ItemType> Deno.args[2].trim().toLowerCase();
const projectName: string = Deno.args[3].trim();
const token = Deno.args[4].trim();

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Issue Or PR Number (Required): ${issueOrPRNumber}`,
	`Item Type (Required): ${itemType}`,
	`Project Name (Required): ${projectName}`,
	`GitHub Token (Required): ****`,
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const numberInvalid = issueOrPRNumber <= 0;

const doesNotExistErrorMsg = `The issue or PR number '${issueOrPRNumber}' does not exist in the '${repoName}' repo.`;

if (numberInvalid) {
	Utils.printAsGitHubError(doesNotExistErrorMsg);
	Deno.exit(1);
}

const ISSUE_TYPE = "issue";
const PR_TYPE = "pull-request";

let itemUrl = "";
let itemNodeId = "";

switch (itemType) {
	case ISSUE_TYPE: {
		const issueClient: IssueClient = new IssueClient(token);
		const issue: IIssueModel = await issueClient.getIssue(repoName, issueOrPRNumber);

		itemNodeId = issue.node_id === undefined ? "" : issue.node_id;
		itemUrl = issue.html_url === undefined ? "" : issue.html_url;

		break;
	}
	case PR_TYPE: {
		const prClient: PullRequestClient = new PullRequestClient(token);

		const prDoesNotExist = !(await prClient.pullRequestExists(repoName, issueOrPRNumber));

		if (prDoesNotExist) {
			Utils.printAsGitHubError(doesNotExistErrorMsg);
			Deno.exit(1);
		}

		const pr: IPullRequestModel = await prClient.getPullRequest(repoName, issueOrPRNumber);

		itemNodeId = pr.node_id === undefined ? "" : pr.node_id;
		itemUrl = pr.html_url === undefined ? "" : pr.html_url;

		break;
	}
	default:
		Utils.printAsGitHubError(
			`The item type '${itemType}' is invalid. It must be a value of 'issue' or 'pull-request'.`,
		);
		break;
}

const projectClient: ProjectClient = new ProjectClient(token);

const projectDoesNotExist = !(await projectClient.projectExists(projectName));

if (projectDoesNotExist) {
	Utils.printAsGitHubError(`The organization project '${projectName}' does not exist.`);
	Deno.exit(1);
}

await projectClient.addToProject(itemNodeId, projectName);

const itemTypeName = itemType === ISSUE_TYPE ? "issue" : "pull request";
console.log(
	`✅The ${itemTypeName} '${issueOrPRNumber}' has been added to the project '${projectDoesNotExist}'!✅\n${itemUrl}`,
);

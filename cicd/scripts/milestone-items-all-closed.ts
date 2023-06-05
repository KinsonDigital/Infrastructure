import { MilestoneClient } from "../core/MilestoneClient.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length < 3) {
	let errorMsg =
		`The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg +=
		"\nThe 2nd arg is required and must be the type of release. Valid values are 'Production' and 'Preview'.";
	errorMsg += "\nThe 3rd arg is optional and must be the version of the release.";

	Utils.printAsGitHubError(`${errorMsg}`);
	Deno.exit(1);
}

const repoName = "Infrastructure";
const milestoneName = "v1.2.3-preview.4";
const token = "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Milestone (Required): ${milestoneName}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const milestoneClient: MilestoneClient = new MilestoneClient(token);
const milestoneItems = await milestoneClient.getIssuesAndPullRequests(repoName, milestoneName);

const issues: IIssueModel[] = Utils.filterIssues(milestoneItems);
const prs: IPullRequestModel[] = Utils.filterPullRequests(milestoneItems);

const problemsFound: string[] = [];

// Find all issues that are not closed
issues.forEach((issue) => {
	if (issue.state != "closed") {
		const url = `https://github.com/${repoName}/issues/${issue.number}`;
		problemsFound.push(`Issue #${issue.number} is not closed.\n${url}`);
	}
});

// Find all pull requests that are not closed
prs.forEach((pr) => {
	if (pr.state != "closed") {
		const url = `https://github.com/${repoName}/pull/${pr.number}`;
		problemsFound.push(`Pull request #${pr.number} is not closed.\n${url}`);
	}
});

// Find all pull requests that are still in draft
prs.forEach((pr) => {
	if (pr.draft === true) {
		const url = `https://github.com/${repoName}/pull/${pr.number}`;
		problemsFound.push(`Pull request #${pr.number} is still in draft.\n${url}`);
	}
});

Utils.printProblemList(problemsFound).then(() => {
	console.log("✅No Problems Found!!  All issues and pull requests are closed and no pull requests are in draft.✅");
}).catch((error) => {
	console.log(error);
	Deno.exit(1);
});

import { MilestoneClient } from "../clients/MilestoneClient.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length < 2) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 2 arguments with 1 additional optional argument.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be the title of the milestone.";
	errorMsg += "\nThe 3rd arg is optional and must be the GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const milestoneTitle = Deno.args[1].trim();
const token = Deno.args.length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Milestone (Required): ${milestoneTitle}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(token);

const milestoneDoesNotExist = !(await milestoneClient.milestoneExists(repoName, milestoneTitle));

// Check if the milestone exists
if (milestoneDoesNotExist) {
	Utils.printAsGitHubError(`The milestone '${milestoneTitle}' for repo '${repoName}' does not exist.`);
	Deno.exit(1);
}

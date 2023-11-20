import { MilestoneClient, RepoClient } from "../../deps.ts";
import { Utils } from "../core/Utils.ts";

if (Deno.args.length != 3) {
	let errorMsg = `The cicd script must have 4 arguments but has ${Deno.args.length} argument(s).`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repository owner name.";
	errorMsg += "\nThe 2nd arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 3rd arg is required and must be the title of the milestone.";
	errorMsg += "\nThe 4th arg is required and must be a GitHub PAT (Personal Access Token).";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const ownerName = Deno.args[0].trim();
const repoName = Deno.args[1].trim();
const milestoneTitle = Deno.args[2].trim();
const token = Deno.args.length >= 4 ? Deno.args[3].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Repo Owner (Required): ${ownerName}`,
	`Repo Name (Required): ${repoName}`,
	`Milestone (Required): ${milestoneTitle}`,
	`GitHub Token (Required): ${Utils.isNothing(token) ? "Not Provided" : "****"}`,
]);

const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
const repoDoesNotExist = !(await repoClient.exists());

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(ownerName, repoName, token);

const milestoneDoesNotExist = !(await milestoneClient.milestoneExists(milestoneTitle));

// Check if the milestone exists
if (milestoneDoesNotExist) {
	Utils.printAsGitHubError(`The milestone '${milestoneTitle}' for repo '${repoName}' does not exist.`);
	Deno.exit(1);
}

import { MilestoneClient } from "../clients/MilestoneClient.ts";
import { IMilestoneModel } from "../core/Models/IMilestoneModel.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 3) {
	let errorMsg = `The '${scriptName}' cicd script must have 3 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid milestone name.";
	errorMsg += "\nThe 3rd arg is required and must be a valid GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName: string = Deno.args[0].trim();
const milestoneName: string = Deno.args[1].trim();
const token = Deno.args[2].trim();

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Milestone Name (Required): ${milestoneName}`,
	`GitHub Token (Required): ****`,
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(token);

const milestone: IMilestoneModel = await milestoneClient.getMilestoneByName(repoName, milestoneName);

await milestoneClient.closeMilestone(repoName, milestone.title);

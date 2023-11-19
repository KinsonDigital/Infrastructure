import { RepoClient, MilestoneClient } from "../../deps.ts";
import { MilestoneModel } from "../core/Models/MilestoneModel.ts";
import { Utils } from "../core/Utils.ts";

if (Deno.args.length != 3) {
	let errorMsg = `The cicd script must have 4 arguments but has ${Deno.args.length} argument(s).`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub name of the owner of the repository.";
	errorMsg += "\nThe 2st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 3rd arg is required and must be a valid milestone name.";
	errorMsg += "\nThe 4th arg is required and must be a valid GitHub PAT (Personal Access Token).";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const ownerName: string = Deno.args[0].trim();
const repoName: string = Deno.args[1].trim();
const milestoneName: string = Deno.args[2].trim();
const token = Deno.args[3].trim();

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Owner Name (Required): ${ownerName}`,
	`Repo Name (Required): ${repoName}`,
	`Milestone Name (Required): ${milestoneName}`,
	`GitHub Token (Required): ****`,
]);

const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
const repoDoesNotExist = !(await repoClient.exists());

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const milestoneClient: MilestoneClient = new MilestoneClient(ownerName, repoName, token);

const milestone: MilestoneModel = await milestoneClient.getMilestoneByName(milestoneName);

await milestoneClient.closeMilestone(milestone.title);

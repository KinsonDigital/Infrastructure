import { MilestoneClient } from "../core/MilestoneClient.ts";
import { IMilestoneModel } from "../core/Models/IMilestoneModel.ts";
import { RepoClient } from "../core/RepoClient.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { MilestoneNotFound } from "../core/Types.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length != 3) {
	let errorMsg =
		`The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid milestone name.";
	errorMsg += "\nThe 3rd arg is required and must be a valid GitHub token.";

	Utils.printAsGitHubError(`${errorMsg}`);
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

const milestone: IMilestoneModel | MilestoneNotFound = await milestoneClient.getMilestone(repoName, milestoneName);

if (Utils.isMilestoneNotFound(milestone)) {
	Utils.printAsGitHubError(`The milestone '${milestoneName}' does not exist in the '${repoName}' repository.`);
	Deno.exit(1);
}

await milestoneClient.closeMilestone(repoName, milestone.title);

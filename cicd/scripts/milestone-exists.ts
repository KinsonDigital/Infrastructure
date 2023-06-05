import { MilestoneClient } from "../core/MilestoneClient.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length >= 2 && Deno.args.length <= 3) {
	let errorMsg = `The '${scriptName}' cicd script must have 3 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be the title of the milestone.";
	errorMsg += "\nThe 3rd arg is optional and must be the GitHub token.";

	Utils.printAsGitHubError(`${errorMsg}`);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const milestone = Deno.args[1].trim();
const token = Deno.args[2].length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Milestone (Required): ${milestone}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const milestoneClient: MilestoneClient = new MilestoneClient(token);

const milestoneDoesNotExist = !(await milestoneClient.milestoneExists(repoName, milestone));

// Check if the milestone exists
if (milestoneDoesNotExist) {
	Utils.printAsGitHubError(`The milestone '${milestone}' for repo '${repoName}' does not exist.`);
	Deno.exit(1);
}

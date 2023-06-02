import { MilestoneClient } from "../core/MilestoneClient.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName()
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length >= 2 && Deno.args.length <= 3) {
    let errorMsg = `The '${scriptName}' cicd script must have 3 arguments.`;
    errorMsg += "\nThe 1st arg must be the GitHub project name.";
    errorMsg += "\nThe 2nd arg must be the title of the milestone.";
    errorMsg += "\nThe 3rd arg is optional and must be the GitHub token.";

    console.log(`::error::${errorMsg}`);
    Deno.exit(1);
}

const projectName = Deno.args[0].trim();
const milestone = Deno.args[1].trim();
const token = Deno.args[2].length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
    `Project Name: ${projectName}`,
    `Milestone: ${milestone}`,
    `GitHub Token(Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
]);

const milestoneClient: MilestoneClient = new MilestoneClient(token);

const milestoneDoesNotExist: boolean = !(await milestoneClient.milestoneExists(projectName, milestone));

// Check if the milestone exists
if (milestoneDoesNotExist) {
    console.log(`::error::The milestone '${milestone}' for project '${projectName}' does not exist.`);
    Deno.exit(1);
}
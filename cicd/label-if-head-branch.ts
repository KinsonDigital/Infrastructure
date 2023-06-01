import { LabelClient } from "./core/LabelClient.ts";
import { PullRequestClient } from "./core/PullRequestClient.ts";
import { ScriptDescriptions } from "./core/ScriptDescriptions.ts";
import { Utils } from "./core/Utils.ts";

const scriptName = Utils.getScriptName()
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length != 6) {
    let errorMsg = `The '${scriptName}' cicd script must have 6 arguments.`;
    errorMsg += "\nThe 1st arg must be the GitHub project name.";
    errorMsg += "\nThe 2nd arg must be a valid pull request number.";
    errorMsg += "\nThe 3rd arg must be the head branch of the pull request.";
    errorMsg += "\nThe 4th arg must be the intended head branch of the pull request.";
    errorMsg += "\nThe 5th arg must be the label to add if the head branch of the pull request is correct.";
    errorMsg += "\nThe 6th arg is optional and must be the GitHub token.";

    console.log(`::error::${errorMsg}`);
    Deno.exit(1);
}

const projectName = Deno.args[0].trim();
let prNumber: number = 0;

if (Utils.isNumeric(Deno.args[1].trim())) {
    prNumber = parseInt(Deno.args[1].trim());
} else {
    console.log(`::error::The pull request number '${Deno.args[1].trim()}' is not a valid number.`);
    Deno.exit(1);
}

const headBranch = Deno.args[2].trim();
const expectedBranch = Deno.args[3].trim();
const label = Deno.args[4].trim();
const token = Deno.args[5].length >= 6 ? Deno.args[5].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
    `Project Name: ${projectName}`,
    `Pull Request Number: ${prNumber}`,
    `Pull Request Head Branch: ${headBranch}`,
    `Expected Pull Request Head Branch: ${expectedBranch}`,
    `Label: ${label}`,
    "GitHub Token(optional): ****",
]);

// If the pull request head branch does not match the expected branch,
// do not add a label
if (headBranch != expectedBranch) {
    Deno.exit(0);
}

const labelClient: LabelClient = new LabelClient(token);
const labelDoesNotExist: boolean = !(await labelClient.labelExists(projectName, label));

if (labelDoesNotExist) {
    console.log(`::error::The label '${label}' does not exist in the '${projectName}' project.`);
    Deno.exit(1);
}

const prClient: PullRequestClient = new PullRequestClient(token);
await prClient.addLabel(projectName, prNumber, label);

/**
 * Purpose: This script adds a label to a pull request if the head branch of the pull request matches the expected branch.
 */

import { PullRequestClient } from "./core/PullRequestClient.ts";
import { Utils } from "./core/Utils.ts";

if (Deno.args.length != 6) {
    const scriptName = Deno.mainModule.substring(Deno.mainModule.lastIndexOf("/") + 1);
    let errorMsg = `The '${scriptName}' cicd script must have 6 arguments.`;
    errorMsg += "\nThe first arg must be the GitHub project name.";
    errorMsg += "\nThe second arg must be the head branch of the pull request.";
    errorMsg += "\nThe third arg must be the indented head branch of the pull request.";
    errorMsg += "\nThe forth arg must be the label to add if the head branch of the pull request is correct.";
    errorMsg += "\nThe fifth arg must be the GitHub token.";

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
const githubToken = Deno.args[5].trim();

// Print out all of the arguments
Utils.printInGroup("Arguments", [
    `Project Name: ${projectName}`,
    `Pull Request Number: ${prNumber}`,
    `Pull Request Head Branch: ${headBranch}`,
    `Expected Pull Request Head Branch: ${expectedBranch}`,
    `Label: ${label}`,
    "GitHub Token: ****",
]);

// If the pull request head branch does not match the expected branch,
// do not add a label
if (headBranch != expectedBranch) {
    Deno.exit(0);
}

const prClient: PullRequestClient = new PullRequestClient(githubToken);
await prClient.addLabel(projectName, prNumber, label);

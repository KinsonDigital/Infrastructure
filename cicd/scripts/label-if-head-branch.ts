import { LabelClient } from "../clients/LabelClient.ts";
import { PullRequestClient } from "../clients/PullRequestClient.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length != 5) {
	let errorMsg = `The '${scriptName}' cicd script must have 6 arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid pull request number.";
	errorMsg += "\nThe 3rd arg is required and must be the head branch of the pull request.";
	errorMsg += "\nThe 4th arg is required and must be the intended head branch of the pull request.";
	errorMsg += "\nThe 5th arg is required and must be the label to add if the head branch of the pull request is correct.";
	errorMsg += "\nThe 6th arg is required and must be the GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
let prNumber = 0;

if (Utils.isNumeric(Deno.args[1].trim())) {
	prNumber = parseInt(Deno.args[1].trim());
} else {
	Utils.printAsGitHubError(`The pull request number '${Deno.args[1].trim()}' is not a valid number.`);
	Deno.exit(1);
}

const headBranch = Deno.args[2].trim();
const expectedBranch = Deno.args[3].trim();
const label = Deno.args[4].trim();
const token = Deno.args[5].trim();

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Pull Request Number (Required): ${prNumber}`,
	`Pull Request Head Branch (Required): ${headBranch}`,
	`Expected Pull Request Head Branch (Required): ${expectedBranch}`,
	`Label (Required): ${label}`,
	"GitHub Token (optional): ****",
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

// If the pull request head branch does not match the expected branch,
// do not add a label
if (headBranch != expectedBranch) {
	Deno.exit(0);
}

const labelClient: LabelClient = new LabelClient(token);
const labelDoesNotExist = !(await labelClient.labelExists(repoName, label));

if (labelDoesNotExist) {
	Utils.printAsGitHubError(`The label '${label}' does not exist in the '${repoName}' repo.`);
	Deno.exit(1);
}

const prClient: PullRequestClient = new PullRequestClient(token);
await prClient.addLabel(repoName, prNumber, label);

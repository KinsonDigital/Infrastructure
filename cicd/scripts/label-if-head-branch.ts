import { LabelClient, PullRequestClient, RepoClient } from "../../deps.ts";
import { Utils } from "../core/Utils.ts";

const labelIfHeadBranchExecutor = async () => {
	if (Deno.args.length != 6) {
		let errorMsg = `The  cicd script must have 7 arguments but has ${Deno.args.length} argument(s).`;
		errorMsg += "\nThe 1st arg is required and must be the GitHub repository owner name.";
		errorMsg += "\nThe 2nd arg is required and must be the GitHub repo name.";
		errorMsg += "\nThe 3rd arg is required and must be a valid pull request number.";
		errorMsg += "\nThe 4th arg is required and must be the head branch of the pull request.";
		errorMsg += "\nThe 5th arg is required and must be the intended head branch of the pull request.";
		errorMsg += "\nThe 6th arg is required and must be the label to add if the head branch of the pull request is correct.";
		errorMsg += "\nThe 7th arg is required and must be a GitHub PAT (Personal Access Token).";

		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	const ownerName = Deno.args[0].trim();
	const repoName = Deno.args[1].trim();
	let prNumber = 0;

	if (Utils.isNumeric(Deno.args[2].trim())) {
		prNumber = parseInt(Deno.args[2].trim());
	} else {
		Utils.printAsGitHubError(`The pull request number '${Deno.args[2].trim()}' is not a valid number.`);
		Deno.exit(1);
	}

	const headBranch = Deno.args[3].trim();
	const expectedBranch = Deno.args[4].trim();
	const label = Deno.args[5].trim();
	const token = Deno.args[6].trim();

	// Print out all of the arguments
	Utils.printInGroup("Script Arguments", [
		`Repo Owner (Required): ${ownerName}`,
		`Repo Name (Required): ${repoName}`,
		`Pull Request Number (Required): ${prNumber}`,
		`Pull Request Head Branch (Required): ${headBranch}`,
		`Expected Pull Request Head Branch (Required): ${expectedBranch}`,
		`Label (Required): ${label}`,
		"GitHub Token (Required): ****",
	]);

	const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
	const repoDoesNotExist = !(await repoClient.exists());

	if (repoDoesNotExist) {
		Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
		Deno.exit(1);
	}

	// If the pull request head branch does not match the expected branch,
	// do not add a label
	if (headBranch != expectedBranch) {
		Deno.exit(0);
	}

	const labelClient: LabelClient = new LabelClient(ownerName, repoName, token);
	const labelDoesNotExist = !(await labelClient.labelExists(label));

	if (labelDoesNotExist) {
		Utils.printAsGitHubError(`The label '${label}' does not exist in the '${repoName}' repo.`);
		Deno.exit(1);
	}

	const prClient: PullRequestClient = new PullRequestClient(ownerName, repoName, token);
	await prClient.addLabel(prNumber, label);
};

labelIfHeadBranchExecutor();

export default labelIfHeadBranchExecutor;

import { LabelClient, PullRequestClient, RepoClient } from "@kd-clients/github";
import getEnvVar from "../core/GetEnvVar.ts";
import { Utils } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const prNumberStr = getEnvVar("PR_NUMBER", scriptFileName);

let prNumber = 0;

if (Utils.isNumeric(prNumberStr)) {
	prNumber = parseInt(prNumberStr);
} else {
	Utils.printAsGitHubError(`The pull request number '${prNumber}' is not a valid number.`);
	Deno.exit(1);
}

const headBranch = getEnvVar("HEAD_BRANCH", scriptFileName);
const expectedBranch = getEnvVar("EXPECTED_BRANCH", scriptFileName);
const label = getEnvVar("LABEL", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

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
const labelDoesNotExist = !(await labelClient.exists(label));

if (labelDoesNotExist) {
	Utils.printAsGitHubError(`The label '${label}' does not exist in the '${repoName}' repo.`);
	Deno.exit(1);
}

const prClient: PullRequestClient = new PullRequestClient(ownerName, repoName, token);
await prClient.addLabel(prNumber, label);

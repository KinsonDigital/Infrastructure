import { MilestoneClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { getEnvVar, isNothing } from "../../cicd/core/Utils.ts";
import { printAsGitHubError, setGitHubOutput } from "../../cicd/core/github.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const milestoneName = getEnvVar("MILESTONE_NAME", scriptFileName);
const failIfDoesNotExist = getEnvVar("FAIL_IF_DOES_NOT_EXIST", scriptFileName).toLowerCase() === "true";
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

const milestoneClient = new MilestoneClient(ownerName, repoName, token);

const milestoneExists = await milestoneClient.exists(milestoneName);

setGitHubOutput("milestone-exists", milestoneExists ? "true" : "false");

if (failIfDoesNotExist && !milestoneExists) {
	const errorMsg = `The milestone '${milestoneName}' for repo '${repoName}' does not exist.` +
		(isNothing(scriptFileName) ? "" : `\n\t${scriptFileName}`);

	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

import { MilestoneClient } from "https://deno.land/x/kd_clients@v1.0.0-preview.13/GitHubClients/MilestoneClient.ts";
import { printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";
import { getEnvVar } from "../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const repoOwner = getEnvVar("REPO_OWNER", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const milestoneTitle = getEnvVar("MILESTONE_TITLE", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

const client: MilestoneClient = new MilestoneClient(repoOwner, repoName, token);

const exists = await client.milestoneExists(milestoneTitle);

if (!exists) {
	printAsGitHubError(`The milestone '${milestoneTitle}' does not exist.\n\tFile: ${scriptFileName}`);
	Deno.exit(1);
}

await client.closeMilestone(milestoneTitle);

printAsGitHubNotice(`The milestone '${milestoneTitle}' has been closed.`);

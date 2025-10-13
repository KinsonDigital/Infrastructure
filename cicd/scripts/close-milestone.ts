import { MilestoneClient, RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { MilestoneModel } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github/models";
import { printAsGitHubError } from "../core/github.ts";
import { validateOrgExists, validateRepoExists } from "../core/Validators.ts";
import { getEnvVar } from "../core/Utils.ts";

// TODO: REMOVE ME.  I AM GETTING REPLACED BY THE CLOSE MILESTONE ACTION

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const milestoneName = getEnvVar("MILESTONE_NAME", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
const repoDoesNotExist = !(await repoClient.exists());

if (repoDoesNotExist) {
	printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

const milestoneClient: MilestoneClient = new MilestoneClient(ownerName, repoName, token);

const milestone: MilestoneModel = await milestoneClient.getMilestoneByName(milestoneName);

await milestoneClient.closeMilestone(milestone.title);

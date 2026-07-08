import { getEnvVar } from "../../cicd/core/Utils.ts";
import { createMilestone, printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";

const scriptName = `\n\tScript Name : ${import.meta.url.split("/").pop()}`;

const repoOwner = getEnvVar("REPO_OWNER", scriptName);
const repoName = getEnvVar("REPO_NAME", scriptName);
const milestoneTitle = getEnvVar("MILESTONE_TITLE", scriptName);
const token = getEnvVar("GITHUB_TOKEN", scriptName);

try {
	await createMilestone(repoOwner, repoName, milestoneTitle, token);

	printAsGitHubNotice(`The milestone '${milestoneTitle}' has been created successfully in the repository '${repoOwner}/${repoName}'.`);
} catch (error) {
	const errorMsg = error instanceof Error
		? `::error::Network error occurred while trying to create the '${milestoneTitle}' milestone. Error: ${error.message}${scriptName}`
		: `::error::An unexpected error occurred while trying to create the '${milestoneTitle}' milestone.` +
			scriptName;
	
	printAsGitHubError(errorMsg);

	Deno.exit(1);
}

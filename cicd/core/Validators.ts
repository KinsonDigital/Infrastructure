import { MilestoneClient, OrgClient, RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { printAsGitHubError } from "./github.ts";

/**
 * Validates that a GitHub organization exists.
 * @param ownerName The name of the owner (user or organization).
 * @param token The GitHub token.
 */
const validateOrgExists = async (ownerName: string, token: string): Promise<void> => {
	const orgClient = new OrgClient(ownerName, token);

	// If the org does not exist
	if (!(await orgClient.exists())) {
		const errorMsg = `The organization '${ownerName}' does not exist.`;

		printAsGitHubError(errorMsg);
		Deno.exit(1);
	}
};

/**
 * Validates that a GitHub organization exists.
 * @param ownerName The name of the owner (user or organization).
 * @param repoName The name of the repository.
 * @param token The GitHub token.
 */
const validateRepoExists = async (ownerName: string, repoName: string, token: string): Promise<void> => {
	const repoClient = new RepoClient(ownerName, repoName, token);

	if (!(await repoClient.exists())) {
		const errorMsg = `The repository '${repoName}' does not exist.`;

		printAsGitHubError(errorMsg);
		Deno.exit(1);
	}
};

/**
 * Validates that a GitHub milestone exists.
 * @param ownerName The name of the owner (user or organization).
 * @param repoName The name of the repository.
 * @param milestoneTitle The title of the milestone.
 * @param token The GitHub token.
 */
const validateMilestoneExists = async (ownerName: string, repoName: string, milestoneTitle: string, token: string): Promise<void> => {
	const milestoneClient = new MilestoneClient(ownerName, repoName, token);

	if (!(await milestoneClient.exists(milestoneTitle))) {
		const errorMsg = `The milestone '${milestoneTitle}' for repo '${repoName}' does not exist.`;

		printAsGitHubError(errorMsg);
		Deno.exit(1);
	}
};

export { validateMilestoneExists, validateOrgExists, validateRepoExists };

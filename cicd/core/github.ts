import { existsSync } from "jsr:@std/fs@1.0.23";
import { getEnvVar } from "./Utils.ts";

/**
 * Prints the given {@link message} as a GitHub notice.
 * @param message The message to print.
 */
export function printAsGitHubNotice(message: string): void {
	console.log();
	console.log(`::notice::${message}`);
	console.log();
}

/**
 * Prints the given {@link messages} as GitHub notices.
 * @param messages The messages to print.
 */
export function printAsGitHubNotices(messages: string[]): void {
	messages.forEach((message) => {
		printAsGitHubNotice(message);
	});
}

/**
 * Prints the given {@link message} as a GitHub error.
 * @param message The message to print.
 */
export function printAsGitHubError(message: string): void {
	console.log();
	console.log(`::error::${message}`);
	console.log();
}

/**
 * Prints the given {@link messages} as GitHub errors.
 * @param messages The error messages.
 */
export function printAsGitHubErrors(messages: string[]): void {
	messages.forEach((message) => {
		printAsGitHubError(message);
	});
}

/**
 * Prints the given {@link message} as a GitHub warning.
 * @param message The message to print.
 */
export function printAsGitHubWarning(message: string): void {
	console.log();
	console.log(`::warning::${message}`);
	console.log();
}

/**
 * Creates a name value pair using the given {@link name} and {@link value} and saves it to the GitHub output file.
 * @param value The value of the output.
 */
export function setGitHubOutput(name: string, value: string): void {
	const githubOutputFilePath = getEnvVar("GITHUB_OUTPUT", undefined, true);

	if (!existsSync(githubOutputFilePath)) {
		const errorMsg = `The GitHub output file path '${githubOutputFilePath}' does not exist.`;
		console.error(errorMsg);
		Deno.exit(1);
	}

	Deno.writeTextFileSync(githubOutputFilePath, `${name}=${value}\n`, { append: true });
}

/**
 * Creates a new milestone in the specified GitHub repository.
 * @param ownerName The name of the repository owner.
 * @param repoName The name of the repository.
 * @param milestoneTitle The title of the milestone to create.
 * @param token The GitHub personal access token.
 */
export async function createMilestone(ownerName: string, repoName: string, milestoneTitle: string, token: string): Promise<void> {
	const url = `https://api.github.com/repos/${ownerName}/${repoName}/milestones`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Accept": "application/vnd.github.v3+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"Authorization": `Bearer ${token}`,
		},
		body: JSON.stringify({
			title: milestoneTitle,
		}),
	});

	if (response.status !== 201) {
		const responseBody = await response.text();
		const otherInfo = `Error: ${response.status} ${response.statusText}\nResponse: ${responseBody}`;

		const errorMsg = `::error::Failed to create the '${milestoneTitle}' milestone.\n${otherInfo}`;
		throw new Error(errorMsg);
	}
}

import { existsSync } from "jsr:@std/fs@1.0.19";
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

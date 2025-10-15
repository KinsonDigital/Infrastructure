import { printAsGitHubError } from "../github.ts";
import { isLessThanOne, isNothing } from "../guards.ts";

/**
 * Provides markdown related services.
 */
export class MarkdownService {
	/**
	 * Creates a markdown link.
	 * @param text The text of the link.
	 * @param url The URL of the link.
	 * @returns The markdown link.
	 */
	public createMarkdownLink(text: string, url: string): string {
		if (isNothing(text)) {
			printAsGitHubError("The text parameter cannot be null, undefined, or empty.");
			Deno.exit(1);
		}

		if (isNothing(url)) {
			printAsGitHubError("The url parameter cannot be null, undefined, or empty.");
			Deno.exit(1);
		}

		return `[${text}](${url})`;
	}

	/**
	 * Creates a markdown header using the given {@link text} and {@link level}.
	 * @param text The text of the header.
	 * @param level The level of the header.
	 * @param isBold True to set the header as bold.
	 * @returns The markdown header.
	 */
	public createHeader(text: string, level: number, isBold = false): string {
		if (isNothing(text)) {
			printAsGitHubError("The text parameter cannot be null, undefined, or empty.");
			Deno.exit(1);
		}

		if (isLessThanOne(level)) {
			printAsGitHubError("The level parameter must be greater than zero.");
			Deno.exit(1);
		}

		level = level < 1 ? 1 : level;
		level = level > 6 ? 6 : level;

		const asterisks = isBold ? "**" : "";

		return `${"#".repeat(level)} ${asterisks}${text}${asterisks}`;
	}

	/**
	 * Creates a markdown checkbox.
	 * @param text The text of the checkbox.
	 * @param isChecked True to check the checkbox, false otherwise.
	 * @returns The markdown checkbox.
	 */
	public createCheckBox(text: string, isChecked = false): string {
		return `- [${isChecked ? "x" : " "}] ${text}`;
	}
}

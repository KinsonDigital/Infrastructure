import { Guard } from "../Guard.ts";

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
		const funcName = "createMarkdownLink";
		Guard.isNullOrEmptyOrUndefined(text, funcName, "text");
		Guard.isNullOrEmptyOrUndefined(url, funcName, "url");

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
		const funcName = "createHeader";
		Guard.isNullOrEmptyOrUndefined(text, funcName, "text");
		Guard.isLessThanOne(level, funcName, "level");

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

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
}

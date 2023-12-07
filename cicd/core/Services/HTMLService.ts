import { Guard } from "../Guard.ts";
import { Utils } from "../Utils.ts";

/**
 * Provides HTML related services.
 */
export class HTMLService {
	/**
	 * Creates an HTML header of the given {@link level} and with the given {@link text}.
	 * @param text The text of the header.
	 * @param level The header level.
	 * @param onSeparateLines Whether or not to put the header tags and text on separate lines.
	 * @returns The HTML header.
	 */
	public createHeader(
		text: string,
		level: number,
		color?: string,
		isBold?: boolean,
		isCentered?: boolean,
		onSeparateLines?: boolean,
	): string {
		Guard.isNullOrEmptyOrUndefined(text, "createHeader", "text");

		if (level < 1 || level > 6) {
			Utils.printAsGitHubError(`The header level '${level}' is not valid. It must be between 1 and 6.`);
			Deno.exit(1);
		}

		let style = "";

		if (!Utils.isNothing(color) || !Utils.isNothing(isBold)) {
			style = `style="`;

			if (!Utils.isNothing(color)) {
				style += `color: ${color};`;
			}

			if (!Utils.isNothing(isBold) && isBold) {
				style += "font-weight: bold;";
			}

			style += `"`;
		}

		const centeredAttr = isCentered ? this.createCenteredAttr() : "";

		if (Utils.isNothing(onSeparateLines) || !onSeparateLines) {
			return `<h${level} ${centeredAttr} ${style}>${text}</h${level}>`;
		} else {
			return `<h${level} ${centeredAttr} ${style}>\n${text}\n</h${level}>`;
		}
	}

	/**
	 * Creates a centered HTML div tag containing the given {@link text}.
	 * @param text The text in the div.
	 * @param onSeparateLines Whether or not to put the div tags and text on separate lines.
	 * @returns The HTML div.
	 */
	public createCenteredDiv(text: string, onSeparateLines?: boolean): string {
		Guard.isNullOrEmptyOrUndefined(text, "createCenteredDiv", "text");

		if (onSeparateLines) {
			return `<div ${this.createCenteredAttr()}>\n${text}\n</div>`;
		} else {
			return `<div ${this.createCenteredAttr()}>${text}</div>`;
		}
	}

	/**
	 * Creates a centered attribute.
	 * @returns The attribute.
	 */
	private createCenteredAttr(): string {
		return `align="center"`;
	}
}

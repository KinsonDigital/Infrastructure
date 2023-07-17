import { Directory } from "../../core/Directory.ts";
import { GitHubLogType } from "../../core/Enums.ts";
import { File } from "../../core/File.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Transpiles the HTML content in a README.md file to markdown.
 */
export class TranspileReadMeRunner extends ScriptRunner {
	private readonly readmeFileName = "README.md";
	private readonly scriptName: string;
	private readonly divStartTagRegEx = /<div.*>/gm;
	private readonly divEndTagRegEx = /<\/div\s*>/gm;
	private readonly breakTagRegEx = /<br\s*\/>/gm;
	private readonly headerTagRegEx = /<h[1-6].*>.*<\/h[1-6]>/gm;
	private readonly headerStartTagRegEx = /<h[1-6].*?>/gm;
	private readonly headerEndTagRegEx = /<\/h[1-6]>/gm;
	private readonly styleAttrWithBoldRegEx = /style=\"(font:.*\sbold\s.*|font-weight:.*bold.*)\"/gm;
	private readonly imageTagRegEx = /<img .*src\s*=\s*('|").+('|").*>/gm;
	private readonly imgSrcAttrRegEx = /src\s*=\s*('|").+?('|")/gm;
	private readonly linkStartTagRegEx = /<a\s*href\s*=\s*('|").+?('|")>/gm;
	private readonly linkEndTagRegEx = /<\/\s*a\s*>/gm;
	private readonly markdownStartingWithWhiteSpaceRegEx = /^\s+!*\[.+\]\(.+\)/g;

	/**
	 * Initializes a new instance of the {@link TranspileReadMeRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[], scriptName: string) {
		super(args);
		this.scriptName = scriptName;
	}

	/**
	 * Runs the transpile readme script.
	 */
	// deno-lint-ignore require-await
	public async run(): Promise<void> {
		const dirPath = this.args[0];

		const readmeFilePath = `${dirPath}/${this.readmeFileName}`;

		if (File.DoesNotExist(readmeFilePath)) {
			let errorMsg = `Error with script '${this.scriptName}'`;
			errorMsg += `\nThe given path '${readmeFilePath}' is not a valid file path.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		let readmeFileContent = File.LoadFile(readmeFilePath);

		// Remove start and end div tags
		readmeFileContent = readmeFileContent.replace(this.divStartTagRegEx, "");
		readmeFileContent = readmeFileContent.replace(this.divEndTagRegEx, "");

		// Remove start and end link tags
		readmeFileContent = readmeFileContent.replace(this.linkStartTagRegEx, "");
		readmeFileContent = readmeFileContent.replace(this.linkEndTagRegEx, "");

		// Remove all break tags
		readmeFileContent = readmeFileContent.replaceAll(this.breakTagRegEx, "");

		readmeFileContent = this.transpileHeaderTags(readmeFileContent);

		readmeFileContent = this.transpileImageTags(readmeFileContent);

		readmeFileContent = this.bumpMarkdownLinksToLeft(readmeFileContent);

		// Overwrite the README.md file with the transpiled content
		File.SaveFile(readmeFilePath, readmeFileContent);

		Utils.printAsGitHubNotice("Successfully transpiled the README.md file.");
	}

	/**
	 * @inheritdoc
	 */
	protected validateArgs(args: string[]): void {
		if (args.length != 1) {
			const argDescriptions = [
				`The cicd script must have 1 argument.`,
				`Required and must be a valid directory path to the 'README.md' file.`,
			];

			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.error);
			Deno.exit(1);
		}

		if (Directory.DoesNotExist(args[0])) {
			Utils.printAsGitHubError(`The given path '${args[0]}' is not a valid directory path.`);
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let dirPath = Utils.normalizePath(args[0]);
		dirPath = Utils.trimAllEndingValue(dirPath, "/");

		return [dirPath];
	}

	/**
	 * Transpiles all HTML header tags to markdown headers.
	 * @param content The content to transpile.
	 * @returns The transpiled content.
	 */
	private transpileHeaderTags(content: string): string {
		const headers = content.match(this.headerTagRegEx)?.filter((h) => h) ?? [];

		for (const headerHtml of headers) {
			let headerContent = headerHtml.replace(this.headerStartTagRegEx, "");
			headerContent = headerContent.replace(this.headerEndTagRegEx, "");

			// If the header style is set to bold
			if (this.styleAttrWithBoldRegEx.test(content)) {
				headerContent = `**${headerContent}**`;
			}

			const headerLevel = this.getHeaderLevel(headerHtml);
			const hashes = this.generateDuplicates("#", headerLevel);

			const headerMarkdown = `${hashes} ${headerContent}`;

			content = content.replaceAll(headerHtml, headerMarkdown);
		}

		return content;
	}

	/**
	 * Transpiles all HTML image tags to markdown images.
	 * @param content The content to transpile.
	 * @returns The transpiled content.
	 */
	private transpileImageTags(content: string): string {
		const imgHtmlTags = content.match(this.imageTagRegEx)?.filter((h) => h) ?? [];

		for (const imgHtml of imgHtmlTags) {
			const imgSrcAttr = imgHtml.match(this.imgSrcAttrRegEx)?.filter((h) => h)[0] ?? "";

			let srcUri = imgSrcAttr.replace("src=", "");
			srcUri = srcUri.replaceAll('"', "");
			srcUri = srcUri.replaceAll("'", "");

			const imgMarkdown = `![image](${srcUri})`;

			content = content.replaceAll(imgHtml, imgMarkdown);
		}

		return content;
	}

	/**
	 * Finds all markdown links that are preceded by white space and bumps them to the left
	 * by removing that beginning white space.
	 * @param content The content to mutate.
	 * @returns The mutated content.
	 */
	private bumpMarkdownLinksToLeft(content: string): string {
		content = Utils.normalizeLineEndings(content);

		const lines = Utils.splitBy(content, "\n");

		for (let i = 0; i < lines.length; i++) {
			if (this.markdownStartingWithWhiteSpaceRegEx.test(lines[i])) {
				lines[i] = Utils.trimAllStartingWhiteSpace(lines[i]);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Gets the header level of the given {@link htmlHeader}.
	 * @param htmlHeader The HTML header to analyze.
	 * @returns The header level of 1 to 6.
	 */
	private getHeaderLevel(htmlHeader: string): number {
		const headerStartTags = htmlHeader.match(this.headerStartTagRegEx)?.filter((h) => h) ?? [];

		const headerStartTag = headerStartTags[0].toLowerCase();

		// Split the start tag right after the '<h1' section
		const sections = Utils.splitBy(headerStartTag, " ");
		const startSection = sections[0];

		const headerLevelStr = startSection.replace("<h", "");

		return parseInt(headerLevelStr);
	}

	/**
	 * Returns the given {@link value} duplicated {@link count} times.
	 * @param value The value to duplicate.
	 * @param count The number of times to duplicate the {@link value}.
	 * @returns The given {@link value} duplicated {@link count} times.
	 */
	private generateDuplicates(value: string, count: number): string {
		let duplicates = "";

		for (let i = 0; i < count; i++) {
			duplicates += value;
		}

		return duplicates;
	}
}

import { ReleaseType } from "../Enums.ts";
import { IssueModel } from "../Models/IssueModel.ts";
import { PullRequestModel } from "../Models/PullRequestModel.ts";
import { HTMLService } from "./HTMLService.ts";
import { MarkdownService } from "./MarkdownService.ts";
import { Utils } from "../Utils.ts";

/**
 * Generates preview or production release notes.
 */
export class GenerateReleaseNotesService {
	private readonly htmlService: HTMLService;
	private readonly markdownService: MarkdownService;
	private readonly noColor = "";
	private readonly newFeatureLabel = "✨new feature";
	private readonly bugLabel = "🐛bug";
	private readonly breakingChangeLabel = "🧨breaking changes";
	private readonly depUpdateLabel = "📦dependency update";
	private readonly titleEmojis = ["🐛", "✨", "🔥", "🚀", "🪧", "🧨", "🚧", "🧪", "🔬", "📦"];

	/**
	 * Initializes a new instance of the {@link GenerateReleaseNotesService} class.
	 */
	constructor() {
		this.htmlService = new HTMLService();
		this.markdownService = new MarkdownService();
	}

	/**
	 * Generates empty release notes with the title, preview message, and the section headers.
	 * @param projectName The name of the project.
	 * @param releaseType The type of release.
	 * @param version The version of the release.
	 * @returns The release notes.
	 */
	public generateEmptyReleaseNotes(
		projectName: string,
		releaseType: ReleaseType,
		version: string,
	): string {
		const title = this.createTitle(projectName, releaseType, version);
		const quickReminder = this.createQuickReminder(releaseType);

		const newFeaturesHeader = this.htmlService.createHeader("New Features ✨", 2, "", true, true);
		const bugFixHeader = this.htmlService.createHeader("Bug Fixes 🐛", 2, this.noColor, true, true);
		const breakingChangeHeader = this.htmlService.createHeader("Breaking Changes 🧨", 2, this.noColor, true, true);
		const depChangeHeader = this.htmlService.createHeader("Dependency Updates 📦", 2, this.noColor, true, true);
		const otherChangesHeader = this.htmlService.createHeader("Other 🪧", 2, this.noColor, true, true);

		let releaseNotes = title;
		releaseNotes += Utils.isNullOrEmptyOrUndefined(quickReminder) ? "" : `\n\n${quickReminder}`;
		releaseNotes += `\n\n${newFeaturesHeader}`;
		releaseNotes += `\n\n${bugFixHeader}`;
		releaseNotes += `\n\n${breakingChangeHeader}`;
		releaseNotes += `\n\n${depChangeHeader}`;
		releaseNotes += `\n\n${otherChangesHeader}`;
		releaseNotes += "\n";

		return releaseNotes;
	}

	/**
	 * Generates release notes based on the given {@link projectName}, {@link releaseType}, {@link version}, {@link issues}, and {@link prs}.
	 * @param projectName The name of the project.
	 * @param releaseType The type of release.
	 * @param version The version of the release.
	 * @param issues The issues to include in the release notes.
	 * @param prs The pull requests to include in the release notes.
	 * @returns The complete release notes.
	 */
	public generateReleaseNotes(
		projectName: string,
		releaseType: ReleaseType,
		version: string,
		issues: IssueModel[],
		prs: PullRequestModel[],
	): string {
		const excludeLabels = [this.newFeatureLabel, this.bugLabel, this.breakingChangeLabel, this.depUpdateLabel];
		const title = this.createTitle(projectName, releaseType, version);
		const quickReminder = this.createQuickReminder(releaseType);

		const newFeaturesHeader = this.htmlService.createHeader("New Features ✨", 2, "", true, true);
		const newFeaturesSection = this.createSection(issues, this.newFeatureLabel, newFeaturesHeader);

		const bugFixHeader = this.htmlService.createHeader("Bug Fixes 🐛", 2, this.noColor, true, true);
		const bugFixesSection = this.createSection(issues, this.bugLabel, bugFixHeader);

		const breakingChangeHeader = this.htmlService.createHeader("Breaking Changes 🧨", 2, this.noColor, true, true);
		const breakingChangesSection = this.createSection(issues, this.breakingChangeLabel, breakingChangeHeader);

		const depChangeHeader = this.htmlService.createHeader("Dependency Updates 📦", 2, this.noColor, true, true);
		const dependencyChangesSection = this.createSection(prs, this.depUpdateLabel, depChangeHeader);

		const otherChangesHeader = this.htmlService.createHeader("Other 🪧", 2, this.noColor, true, true);
		const otherChangesSection = this.createOthersSection(issues, excludeLabels, otherChangesHeader);

		let releaseNotes = title;
		releaseNotes += "\n\n" + quickReminder;
		releaseNotes += Utils.isNullOrEmptyOrUndefined(newFeaturesSection) ? "" : "\n\n" + newFeaturesSection;
		releaseNotes += Utils.isNullOrEmptyOrUndefined(bugFixesSection) ? "" : "\n\n" + bugFixesSection;
		releaseNotes += Utils.isNullOrEmptyOrUndefined(breakingChangesSection) ? "" : "\n\n" + breakingChangesSection;
		releaseNotes += Utils.isNullOrEmptyOrUndefined(dependencyChangesSection) ? "" : "\n\n" + dependencyChangesSection;
		releaseNotes += Utils.isNullOrEmptyOrUndefined(otherChangesSection) ? "" : "\n\n" + otherChangesSection;
		releaseNotes += "\n";

		return releaseNotes;
	}

	/**
	 * Creates a section of the release notes for the given {@link issuesOrPrs} as long as the issues
	 * have the given {@link includeLabel}.
	 * @param issuesOrPrs The issues to include in the section.
	 * @param includeLabel The label to required to include the issue in the section.
	 * @param header The header to use for the section.
	 * @returns The complete release note section.
	 */
	private createSection(
		issuesOrPrs: IssueModel[] | PullRequestModel[],
		includeLabel: string,
		header: string,
	): string {
		const includedIssues = issuesOrPrs.filter((i) => i.labels.some((l) => l.name === includeLabel));

		// If any issues are new features
		if (includedIssues.length > 0) {
			const markdownItems = includedIssues.map((i) => {
				const markdown = this.markdownService.createMarkdownLink(`#${i.number}`, i.html_url ?? "");

				// Strip the title of any common title emojis
				const strippedTitle = this.titleEmojis.reduce((acc, cur) => acc?.replace(cur, ""), i.title);
				return `${markdown} - ${strippedTitle}`;
			});

			this.numberItems(markdownItems);

			return header + "\n\n" + markdownItems.join("\n");
		} else {
			return "";
		}
	}

	/**
	 * Creates a section for the given {@link issuesOrPrs} that do not have any of the given {@link excludeLabels}.
	 * @param issuesOrPrs The issues to include in the section.
	 * @param excludeLabels The list of labels that the issues must not have to be included.
	 * @param header The header to use for the section.
	 * @returns The complete release note section.
	 */
	private createOthersSection(
		issuesOrPrs: IssueModel[] | PullRequestModel[],
		excludeLabels: string[],
		header: string,
	): string {
		const otherIssues = issuesOrPrs.filter((i) => i.labels.every((l) => !excludeLabels.includes(l.name)));

		// If any issues are new features
		if (otherIssues.length > 0) {
			const markdownItems = otherIssues.map((i) => {
				const markdown = this.markdownService.createMarkdownLink(`#${i.number}`, i.html_url ?? "");

				// Strip the title of any common title emojis
				const strippedTitle = this.titleEmojis.reduce((acc, cur) => acc?.replace(cur, ""), i.title);

				return `${markdown} - ${strippedTitle}`;
			});

			this.numberItems(markdownItems);

			return header + "\n\n" + markdownItems.join("\n");
		} else {
			return "";
		}
	}

	/**
	 * Creates a title of the release notes.
	 * @param projectName The name of the project.
	 * @param releaseType The type of release.
	 * @param version The version of the release.
	 * @returns The title for the release notes.
	 */
	private createTitle(projectName: string, releaseType: ReleaseType, version: string): string {
		const releaseTypeStr = Utils.firstLetterToUpper(releaseType);
		const headerText = `${projectName} ${releaseTypeStr} Release Notes - ${version}`;

		return this.htmlService.createHeader(
			headerText,
			1,
			"mediumseagreen",
			true,
			true,
			true,
		);
	}

	/**
	 * Creates a quick reminder for preview release notes.
	 * @param releaseType The type of release.
	 * @returns The quick reminder.
	 * @remarks This is only used for preview releases.
	 */
	private createQuickReminder(releaseType: ReleaseType): string {
		if (releaseType === ReleaseType.preview) {
			const header = this.htmlService.createHeader(
				"Quick Reminder",
				2,
				this.noColor,
				true,
				true,
			);

			// Prefix the text with a new line to make sure it renders in the markdown correctly
			let reminderText = "\nAs with all software, there is always a chance for issues and bugs, especially for preview";
			reminderText += " releases, which is why your input is greatly appreciated. 🙏🏼";

			let result = `${header}\n\n`;
			result += this.htmlService.createCenteredDiv(reminderText, true);

			return result;
		}

		return "";
	}

	/**
	 * Sequentially adds numbers to the beginning of each item in the given {@link values}.
	 * @param values The values to number.
	 */
	private numberItems(values: string[]): void {
		for (let i = 0; i < values.length; i++) {
			const value = values[i];

			values[i] = `${i + 1}. ${value}`;
		}
	}
}

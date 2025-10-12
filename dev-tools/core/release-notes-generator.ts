import { LabelClient, MilestoneClient, RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { IssueModel, PullRequestModel } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github/models";
import { IssueTypeModel } from "./issue-type-model.ts";
import { GeneratorSettings } from "./generator-settings.ts";
import { isNothing } from "../../cicd/core/guards.ts";

type IssueModelNew = IssueModel & { type: IssueTypeModel };

/**
 * Generates release notes based on various settings.
 */
export class ReleaseNotesGenerator {
	private labelClient?: LabelClient = undefined;
	private milestoneClient?: MilestoneClient = undefined;
	private repoClient?: RepoClient = undefined;

	/**
	 * Generates the release notes using the given {@link settings}.
	 * @param settings The settings to use to generate the release notes.
	 */
	public async generateNotes(settings: GeneratorSettings): Promise<string> {
		this.init(settings);

		const releaseNotesList: string[] = [];

		await this.validateSettings(settings);

		const notesHeader = this.createNotesHeader(settings);
		const extraInfo = this.createExtraInfo(settings.extraInfo);
		releaseNotesList.push(notesHeader);
		releaseNotesList.push(extraInfo);

		const issues = await this.getIssues(settings);
		const prs = await this.getPrs(settings);

		let categorySections: Record<string, string[]> = {};

		const issuesWithTypes: IssueModelNew[] = issues.map((issue) => {
			return <IssueModelNew> issue;
		});

		const issueTypeCatSections = this.buildCategoryIssueTypeSections(
			settings.issueCategoryIssueTypeMappings ?? {},
			issuesWithTypes,
		);

		// Create the issue categories and line items
		const issueCatSections = this.buildCategoryLabelSections(settings.issueCategoryLabelMappings ?? {}, issues);

		// Create the pr categories and line items
		const prCatSections = this.buildCategoryLabelSections(settings.prCategoryLabelMappings ?? {}, prs);

		const issueCatLabels: string[] = [];

		// Collect all of the issue category names
		for (const catName in settings.issueCategoryLabelMappings) {
			issueCatLabels.push(settings.issueCategoryLabelMappings[catName].trim());
		}

		// Get all of the issues that do not have any of the labels in the category labels
		const otherCatIssues = settings.otherCategoryName === undefined
			? []
			: issues.filter((issue) => issue.labels.every((label) => !issueCatLabels.includes(label.name)));

		const otherCat: Record<string, string | undefined> = {};
		otherCat[settings?.otherCategoryName ?? ""] = undefined;

		const otherIssueCatSection = this.buildCategoryLabelSections(otherCat, otherCatIssues);

		categorySections = { ...issueTypeCatSections, ...issueCatSections, ...prCatSections, ...otherIssueCatSection };

		for (const section in categorySections) {
			const catSection = categorySections[section].join("\n");
			releaseNotesList.push(`${catSection}\n`);
		}

		return releaseNotesList.join("\n");
	}

	/**
	 * Initializes the generator with the given {@link settings}.
	 * @param settings The settings to use to initialize the generator.
	 */
	private init(settings: GeneratorSettings): void {
		if (isNothing(settings.githubTokenEnvVarName)) {
			const errorMsg = "The 'githubTokenEnvVarName' setting is required and cannot be empty.";
			throw new Error(errorMsg);
		}

		const githubToken = Deno.env.get(settings.githubTokenEnvVarName);

		if (githubToken === undefined) {
			const errorMsg = `The environment variable '${settings.githubTokenEnvVarName}' was not found or is empty.`;
			throw new Error(errorMsg);
		}

		this.labelClient = new LabelClient(settings.ownerName, settings.repoName, githubToken);
		this.milestoneClient = new MilestoneClient(settings.ownerName, settings.repoName, githubToken);
		this.repoClient = new RepoClient(settings.ownerName, settings.repoName, githubToken);

		this.validateSettings(settings);
	}

	/**
	 * Validates the given {@link settings}.
	 * @param settings The settings to validate.
	 */
	private async validateSettings(settings: GeneratorSettings) {
		if (isNothing(settings.ownerName)) {
			const errorMsg = "The 'ownerName' setting is required and cannot be empty.";
			throw new Error(errorMsg);
		}

		if (isNothing(settings.repoName)) {
			const errorMsg = "The 'repoName' setting is required and cannot be empty.";
			throw new Error(errorMsg);
		}

		if (isNothing(settings.headerText)) {
			const errorMsg = "The 'headerText' setting is required and cannot be empty.";
			throw new Error(errorMsg);
		}

		const repoDoesNotExit = !(await this.repoClient?.exists());

		if (repoDoesNotExit) {
			const errorMsg = `The repository '${settings.ownerName}/${settings.repoName}' does not exist.`;
			throw new Error(errorMsg);
		}

		// Validate the labels in the issue category to label mappings
		if (settings.issueCategoryLabelMappings !== undefined) {
			const labelsToCheck = Object.values(settings.issueCategoryLabelMappings).map((l) => l.trim());

			await this.validateLabels("issueCategoryLabelMappings", labelsToCheck);
		}

		// Validate the labels in the pr category to label mappings
		if (settings.prCategoryLabelMappings !== undefined) {
			const labelsToCheck = Object.values(settings.prCategoryLabelMappings).map((l) => l.trim());

			await this.validateLabels("prCategoryLabelMappings", labelsToCheck);
		}

		// Validate the ignore labels
		if (settings.ignoreLabels !== undefined) {
			await this.validateLabels("ignoreLabels", settings.ignoreLabels);
		}
	}

	/**
	 * Validates the given {@link labels}.
	 * @param labelSettingType The type of labels being validated.
	 * @param labels The labels to validate.
	 */
	private async validateLabels(labelSettingType: string, labels: string[]): Promise<void> {
		const invalidLabels: string[] = [];
		const workItems: Promise<boolean>[] = [];

		labels.forEach((labelToCheck) => {
			workItems.push(this.labelClient?.exists(labelToCheck) ?? Promise.resolve(true));
		});

		const results = await Promise.all(workItems);

		for (let i = 0; i < results.length; i++) {
			if (!results[i]) {
				invalidLabels.push(labels[i]);
			}
		}

		//If there are any invalid labels, throw an error
		if (results.some((i) => i === false)) {
			const errorMsg = `The following '${labelSettingType}' label(s) do not exist:\n   ${invalidLabels.join(", ")}`;
			throw new Error(errorMsg);
		}
	}

	/**
	 * Builds a markdown line item using the given {@link issueOrPr} and {@link itemNumber}.
	 * @param issueOrPr The issue or pr to use for the line item.
	 * @param itemNumber The item number in the list.
	 * @returns The markdown line item.
	 */
	private buildLineItem(issueOrPr: IssueModel | PullRequestModel, itemNumber: number): string {
		const markdownLink = this.createMarkDownLink(issueOrPr.number, issueOrPr.html_url ?? "");

		return `${itemNumber + 1}. ${markdownLink} - ${issueOrPr.title}.`;
	}

	/**
	 * Builds category sections for the given {@link categoryMappings} and {@link issues}.
	 * @param categoryMappings The category to label mappings.
	 * @param issues The issues to build the category sections from.
	 * @returns The category sections.
	 */
	private buildCategoryIssueTypeSections(
		categoryMappings: Record<string, string | undefined>,
		issues: IssueModelNew[],
	): Record<string, string[]> {
		const categorySection: Record<string, string[]> = {};

		for (const catName in categoryMappings) {
			const catIssues = issues.filter((issue) => issue.type.name === catName);

			if (catIssues.length > 0) {
				if (categorySection[catName] === undefined) {
					categorySection[catName] = [`${this.createCategoryHeader(catName)}\n`];
				}

				for (let i = 0; i < catIssues.length; i++) {
					const issueItem = this.buildLineItem(catIssues[i], i);

					if (categorySection[catName] === undefined) {
						categorySection[catName] = [issueItem];
					} else {
						categorySection[catName].push(issueItem);
					}
				}
			}
		}

		return categorySection;
	}

	/**
	 * Builds category sections for the given {@link categoryMappings} and {@link issuesOrPrs}.
	 * @param categoryMappings The category to label mappings.
	 * @param issuesOrPrs The issues or prs to build the category sections from.
	 * @returns The category sections.
	 */
	private buildCategoryLabelSections(
		categoryMappings: Record<string, string | undefined>,
		issuesOrPrs: IssueModel[] | PullRequestModel[],
	): Record<string, string[]> {
		const categorySection: Record<string, string[]> = {};

		for (const catName in categoryMappings) {
			const catLabel = categoryMappings[catName];

			const catIssues = issuesOrPrs.filter((issue) =>
				issue.labels.some((label) => catLabel === undefined || label.name === catLabel)
			);

			if (catIssues.length > 0) {
				if (categorySection[catName] === undefined) {
					categorySection[catName] = [`${this.createCategoryHeader(catName)}\n`];
				}

				for (let i = 0; i < catIssues.length; i++) {
					const issueItem = this.buildLineItem(catIssues[i], i);

					if (categorySection[catName] === undefined) {
						categorySection[catName] = [issueItem];
					} else {
						categorySection[catName].push(issueItem);
					}
				}
			}
		}

		return categorySection;
	}

	/**
	 * Builds the milestone name using the given {@link settings}.
	 * @param settings The settings to use to build the milestone name.
	 * @returns The milestone name.
	 */
	private buildMilestoneName(settings: GeneratorSettings) {
		return settings.milestoneName
			.replace("${VERSION}", settings.version ?? "")
			.replace("${ENVIRONMENT}", settings.chosenReleaseType ?? "")
			.replace("${REPONAME}", settings.repoName);
	}

	/**
	 * Gets a list of issues that belong to a milestone.
	 * @param settings The settings to use to get the issues.
	 * @returns The list of issues that belong to a milestone.
	 */
	private async getIssues(settings: GeneratorSettings): Promise<IssueModel[]> {
		const milestoneName = this.buildMilestoneName(settings);

		const issues = await this.milestoneClient?.getIssues(milestoneName) ?? [];

		const ignoreLabels = settings.ignoreLabels ?? [];

		if (ignoreLabels.length === 0) {
			return issues;
		}

		return issues.filter((issue) => issue.labels.every((label) => !ignoreLabels.includes(label.name)))
			.map((issue) => this.sanitizeIssueTitle(settings, issue));
	}

	/**
	 * Gets a list of prs that belong to a milestone.
	 * @param settings The settings to use to get the prs.
	 * @returns The list of prs that belong to a milestone.
	 */
	private async getPrs(settings: GeneratorSettings): Promise<PullRequestModel[]> {
		const milestoneName = this.buildMilestoneName(settings);

		const prs = await this.milestoneClient?.getPullRequests(milestoneName) ?? [];

		const ignoreLabels = settings.ignoreLabels ?? [];

		if (ignoreLabels.length === 0) {
			return prs;
		}

		return prs.filter((pr) => pr.labels.every((label) => !ignoreLabels.includes(label.name)))
			.map((pr) => this.sanitizePrTitle(settings, pr));
	}

	/**
	 * Creates a category header with the given {@link categoryName}.
	 * @param categoryName The name of the category.
	 * @returns The category section.
	 */
	private createCategoryHeader(categoryName: string | undefined): string {
		return categoryName === undefined ? "" : `<h2 align="center" style="font-weight: bold;">${categoryName}</h2>`;
	}

	/**
	 * Sanitizes the issue title by removing emojis and replacing words.
	 * @param settings The settings to use to sanitize the title.
	 * @param title The title to sanitize.
	 * @returns The sanitized title.
	 */
	private sanitizeIssueTitle(settings: GeneratorSettings, issue: IssueModel): IssueModel {
		issue.title = this.sanitizeTitle(settings, issue.title ?? "");

		return issue;
	}

	/**
	 * Sanitizes the pr title by removing emojis and replacing words.
	 * @param settings The settings to use to sanitize the title.
	 * @param title The title to sanitize.
	 * @returns The sanitized title.
	 */
	private sanitizePrTitle(settings: GeneratorSettings, pr: PullRequestModel): PullRequestModel {
		pr.title = this.sanitizeTitle(settings, pr.title ?? "");

		return pr;
	}

	/**
	 * Sanitizes the given {@link title} using the given {@link settings}.
	 * @param settings The settings to use to sanitize the title.
	 * @param title The title to sanitize.
	 * @returns The sanitized title.
	 */
	private sanitizeTitle(settings: GeneratorSettings, title: string): string {
		// Remove all emojis from the title
		if (settings.emojisToRemoveFromTitle !== undefined) {
			for (const emoji of settings.emojisToRemoveFromTitle) {
				title = title.replace(emoji, "");
			}
		}

		if (settings.wordReplacements !== undefined) {
			for (const wordToReplace in settings.wordReplacements) {
				const replacementWord = settings.wordReplacements[wordToReplace];
				title = title.replace(wordToReplace, replacementWord);
			}
		}

		const sections = title.split(" ") ?? [];

		for (const wordToReplace in settings.firstWordReplacements) {
			const replacementWord = settings.firstWordReplacements[wordToReplace];

			// Get the first word and trim all periods from the end
			let firstWord = sections[0];

			firstWord = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

			if (firstWord === wordToReplace) {
				sections[0] = replacementWord;
				break;
			}
		}

		title = sections.join(" ");

		// If there are any words that need to be bolded or italicized
		for (const wordToStyle in settings.styleWordsList) {
			const styleList = settings.styleWordsList[wordToStyle].toLowerCase().trim();

			const styles = styleList.split(",").filter((s) => s === "bold" || s === "italic");

			const isBold = styles.includes("bold");
			const isItalic = styles.includes("italic");

			const italicSyntax = isItalic ? "_" : "";
			const boldSyntax = isBold ? "**" : "";

			title = title.replace(wordToStyle, `${italicSyntax}${boldSyntax}${wordToStyle}${boldSyntax}${italicSyntax}`);
		}

		// If versions are to be bolded and/or italicized
		const versionRegex =
			/(0|[1-9]\d*)(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?/gm;

		const italicSyntax = settings.italicVersions ? "_" : "";
		const boldSyntax = settings.boldedVersions ? "**" : "";

		const versions = Array.from(title.match(versionRegex) ?? []);

		for (const version of versions) {
			title = title.replace(version, `v${italicSyntax}${boldSyntax}${version}${boldSyntax}${italicSyntax}`);
		}

		return title;
	}

	/**
	 * Creates a release notes header using the given {@link settings}.
	 * @param settings The settings to use to create the header.
	 * @returns The release notes header.
	 */
	private createNotesHeader(settings: GeneratorSettings): string {
		const headerText = settings.headerText
			.replace("${VERSION}", settings.version ?? "")
			.replace("${RELEASETYPE}", settings.chosenReleaseType ?? "")
			.replace("${REPONAME}", settings.repoName);

		const extraEmptyLine = settings.extraInfo === undefined ? "" : "\n";
		return `<h1 align="center" style="color: mediumseagreen;font-weight: bold;">\n${headerText}\n</h1>${extraEmptyLine}`;
	}

	/**
	 * Creates an extra info section using the given {@link extraInfo}.
	 * @param extraInfo The extra info used to create the extra info section.
	 * @returns The extra info section.
	 * @remarks The extra info section will be empty if the given {@link extraInfo} is undefined.
	 */
	private createExtraInfo(extraInfo: { title: string; text: string } | undefined): string {
		if (extraInfo === undefined) {
			return "";
		}

		let result = `<h2 align="center" style="font-weight: bold;">${extraInfo.title}</h2>\n\n`;
		result += `<div align="center">\n\n`;
		result += extraInfo.text;
		result += `\n</div>\n`;

		return result;
	}

	/**
	 * Creates a markdown link using the given {@link issueOrPrNumber} and {@link url}.
	 * @param issueOrPrNumber The issue or pr number to use for the link.
	 * @param url The url to use for the link.
	 * @returns The markdown link.
	 */
	private createMarkDownLink(issueOrPrNumber: number, url: string): string {
		return `[#${issueOrPrNumber}](${url})`;
	}
}

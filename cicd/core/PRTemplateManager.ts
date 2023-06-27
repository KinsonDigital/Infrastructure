import { RepoClient } from "../clients/RepoClient.ts";
import { Guard } from "./Guard.ts";
import { IPRTemplateSettings } from "./IPRTemplateSettings.ts";
import { Utils } from "./Utils.ts";

/**
 * Manages the pull request template.
 */
export class PRTemplateManager {
	private readonly baseBranchRegex = /<!--base-branch-->/gm;
	private readonly headBranchRegex = /<!--head-branch-->/gm;
	private readonly validIssueNumRegex = /<!--valid-issue-number-->/gm;
	private readonly titleRegex = /<!--title-->/gm;
	private readonly defaultReviewerRegex = /<!--default-reviewer-->/gm;
	private readonly assigneesRegex = /<!--assignees-->/gm;
	private readonly labelsRegex = /<!--labels-->/gm;
	private readonly projectsRegex = /<!--projects-->/gm;
	private readonly milestoneRegex = /<!--milestone-->/gm;
	private readonly issueNumTemplateVarRegex = /\${{\s*issue-number\s*}}/gm;
	private readonly issueNumRegex = /#[0-9]+/gm;
	private readonly syncFlagRegex = /<!--sync-flag-->/gm;
	private readonly syncEmptyCheckRegex = /- \[ \] /gm;
	private readonly syncFullCheckRegex = /- \[(x|X)\] /gm;
	private readonly isInSyncLineRegex = /(✅|❌) .+<!--.+-->/gm;
	private readonly lineInSyncRegex = /✅ .+<!--.+-->/gm;
	private readonly lineOutOfSyncRegex = /❌ .+<!--.+-->/gm;
	private readonly repoClient: RepoClient;

	/**
	 * Initializes a new instance of the {@link PRTemplateManager} class.
	 * @param token The GitHub token to use for authentication.
	 */
	constructor(token?: string) {
		this.repoClient = new RepoClient(token);
	}

	/**
	 * Gets a pull request template with the a link to an issue that matches the given {@link issueNumber}.
	 * @param repoName The name of the repository.
	 * @param relativeTemplatePath The relative file path to the template.
	 * @param issueNumber The issue number to use for linking the pull request to the issue.
	 * @returns The pull request template.
	 * @remarks The {@link relativeTemplatePath} is a file path that is located relative to the root
	 * of a repository that matches the given {@link repoName}.
	 */
	public async getPullRequestTemplate(repoName: string, relativeTemplatePath: string, issueNumber: number): Promise<string> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getPullRequestTemplate", "repoName");
		Guard.isNullOrEmptyOrUndefined(relativeTemplatePath, "getPullRequestTemplate", "relativeTemplatePath");

		let templatedData = await this.repoClient.getFileContent(repoName, relativeTemplatePath);
		templatedData = templatedData.replace(this.issueNumTemplateVarRegex, issueNumber.toString());

		return templatedData;
	}

	/**
	 * Processes the given {@link template} with the given {@link settings}.
	 * @param template The template to process.
	 * @param settings The various settings to use for processing the template.
	 * @returns The template after processing.
	 */
	public processSyncTemplate(template: string, settings: IPRTemplateSettings): string {
		Guard.isNullOrEmptyOrUndefined(template, "processSyncTemplate", "template");

		template = template.replace(/(?:\r\n|\r|\n)/g, "\n");

		const fileDataLines: string[] = template.split("\n");

		for (let i = 0; i < fileDataLines.length; i++) {
			const line = fileDataLines[i];

			const isInSyncLine = line.match(this.isInSyncLineRegex) != null;

			// If the line is a sync line with any sync status
			if (isInSyncLine) {
				if (line.match(this.headBranchRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.headBranchValid);
				} else if (line.match(this.baseBranchRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.baseBranchValid);
				} else if (line.match(this.validIssueNumRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.issueNumValid);
				} else if (line.match(this.titleRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.titleInSync);
				} else if (line.match(this.defaultReviewerRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.defaultReviewerValid);
				} else if (line.match(this.assigneesRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.assigneesInSync);
				} else if (line.match(this.labelsRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.labelsInSync);
				} else if (line.match(this.projectsRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.projectsInSync);
				} else if (line.match(this.milestoneRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.milestoneInSync);
				}
			}
		}

		return fileDataLines.join("\n");
	}

	/**
	 * Returns a value indicating whether or not syncing is disabled in the template.
	 * @param template The template to check.
	 * @returns True if syncing is disabled, false otherwise.
	 */
	public syncingDisabled(template: string): boolean {
		if (Utils.isNullOrEmptyOrUndefined(template)) {
			return true;
		}

		const fileDataLines: string[] = template.split("\n");

		for (let i = 0; i < fileDataLines.length; i++) {
			const line = fileDataLines[i];

			if (line.match(this.syncFlagRegex)) {
				if (line.match(this.syncEmptyCheckRegex)) {
					return true;
				} else if (line.match(this.syncFullCheckRegex)) {
					return false;
				}
			}
		}

		return false;
	}

	/**
	 * Returns a value indicating whether or not the template is a PR sync template.
	 * @param template The template to check.
	 * @returns True if the template is a PR sync template, false otherwise.
	 */
	public isPRSyncTemplate(template: string): boolean {
		const baseBranchSyntaxExists = template.match(this.baseBranchRegex) != null;
		const headBranchSyntaxExists = template.match(this.headBranchRegex) != null;
		const validIssueNumSyntaxExists = template.match(this.validIssueNumRegex) != null;
		const titleSyntaxExists = template.match(this.titleRegex) != null;
		const defaultReviewerSyntaxExists = template.match(this.defaultReviewerRegex) != null;
		const assigneesSyntaxExists = template.match(this.assigneesRegex) != null;
		const labelsSyntaxExists = template.match(this.labelsRegex) != null;
		const projectsSyntaxExists = template.match(this.projectsRegex) != null;
		const milestoneSyntaxExists = template.match(this.milestoneRegex) != null;

		return baseBranchSyntaxExists &&
			headBranchSyntaxExists &&
			validIssueNumSyntaxExists &&
			titleSyntaxExists &&
			defaultReviewerSyntaxExists &&
			assigneesSyntaxExists &&
			labelsSyntaxExists &&
			projectsSyntaxExists &&
			milestoneSyntaxExists;
	}

	/**
	 * Returns a value indicating whether or not the template lines is showing as passing.
	 * @param line The template line to check.
	 * @returns True if the line shows as passing, false otherwise.
	 */
	private showsAsPassing(line: string): boolean {
		return line.match(this.lineInSyncRegex) != null && line.match(this.lineOutOfSyncRegex) === null;
	}

	/**
	 * Updates the given template line to show the correct sync status.
	 * @param line The line of text from the template to update.
	 * @param checkIsPassing True if the line should be displayed as passing.
	 * @returns The updated line.
	 */
	private setLineSyncStatus(line: string, checkIsPassing: boolean | undefined): string {
		const showsAsPassing = this.showsAsPassing(line);
		const noStatusDefined = checkIsPassing === undefined;

		if (noStatusDefined) {
			return showsAsPassing ? line.replace(/✅/g, "❔") : line.replace(/❌/g, "❔");
		}

		return checkIsPassing ? line.replace(/❌/g, "✅") : line.replace(/✅/g, "❌");
	}
}

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

	public async getPullRequestTemplate(repoName: string, relativeTemplatePath: string): Promise<string> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getPullRequestTemplate", "repoName");
		Guard.isNullOrEmptyOrUndefined(relativeTemplatePath, "getPullRequestTemplate", "relativeTemplatePath");

		return await this.repoClient.getFileContent(repoName, relativeTemplatePath);
	}

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
			return false;
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
	 * Updates the issue number template variable in the template.
	 * @param template The template to update.
	 * @param issueNum The issue number to update.
	 * @returns The updated template.
	 */
	public updateIssueNum(template: string, issueNum: number): string {
		Guard.isNullOrEmptyOrUndefined(template, "updateIssueVar", "template");
		Guard.isLessThanOne(issueNum, "updateIssueVar", "issueNum");

		const isTemplateVarLine = template.match(this.issueNumTemplateVarRegex) != null;
		const isIssueNumLine = template.match(this.issueNumRegex) != null;

		const lines: string[] = template.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (isTemplateVarLine) {
				lines[i] = line.replace(this.issueNumTemplateVarRegex, issueNum.toString());
			} else if (isIssueNumLine) {
				lines[i] = line.replace(this.issueNumRegex, `#${issueNum}`);
			}

			break;
		}

		return lines.join("\n");
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

	private showsAsPassing(line: string): boolean {
		return line.match(this.lineInSyncRegex) != null && line.match(this.lineOutOfSyncRegex) === null;
	}

	private setLineSyncStatus(line: string, checkIsPassing: boolean | undefined): string {
		const showsAsPassing = this.showsAsPassing(line);
		const noStatusDefined = checkIsPassing === undefined;

		if (noStatusDefined) {
			return showsAsPassing ? line.replace(/✅/g, "❔") : line.replace(/❌/g, "❔");
		}

		return showsAsPassing && !checkIsPassing ? line.replace(/✅/g, "❌") : line.replace(/❌/g, "✅");
	}
}

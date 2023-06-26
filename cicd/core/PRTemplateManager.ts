import { RepoClient } from "../clients/RepoClient.ts";
import { Guard } from "./Guard.ts";
import { IPRTemplateSettings } from "./IPRTemplateSettings.ts";

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
		Guard.isNullOrEmptyOrUndefined(template, "syncingEnabled", "template");

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
	public updateIssueVar(template: string, issueNum: number): string {
		Guard.isNullOrEmptyOrUndefined(template, "updateIssueVar", "template");
		Guard.isLessThanOne(issueNum, "updateIssueVar", "issueNum");

		return template.replace(this.issueNumTemplateVarRegex, issueNum.toString());
	}

	private lineItemShowsInSync(lineItem: string): boolean {
		return lineItem.match(this.syncFlagRegex) !== null;
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

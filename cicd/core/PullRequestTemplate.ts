import { RepoClient } from "../clients/RepoClient.ts";
import { PRTemplateVars } from "./Enums.ts";
import { Guard } from "./Guard.ts";
import { IPRTemplateSettings } from "./IPRTemplateSettings.ts";
import { Utils } from "./Utils.ts";

/**
 * Manages the pull request template.
 */
export class PullRequestTemplate {
	private readonly validIssueNum = /<!--valid-issue-number-->/gm;
	private readonly titleRegex = /<!--title-->/gm;
	private readonly defaultReviewerRegex = /<!--default-reviewer-->/gm;
	private readonly assigneesRegex = /<!--assignees-->/gm;
	private readonly labelsRegex = /<!--labels-->/gm;
	private readonly projectsRegex = /<!--projects-->/gm;
	private readonly milestoneRegex = /<!--milestone-->/gm;
	private readonly syncEnabledRegex = /<!--sync-enabled-->/gm;
	private readonly syncDisabledRegex = /<!--sync-disabled-->/gm;
	private readonly issueNumVarRegex = /\${{\s*issue-num\s*}}/gm;
	private readonly headBranchVarRegex = /\${{\s*head-branch\s*}}/gm;
	private readonly isInSyncLineRegex = /(✅|❌) .+<!--.+-->/gm;
	private readonly lineInSyncRegex = /✅ .+<!--.+-->/gm;
	private readonly lineOutOfSyncRegex = /❌ .+<!--.+-->/gm;
	private readonly repoClient: RepoClient;

	/**
	 * Initializes a new instance of the {@link PullRequestTemplate} class.
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

		if (Utils.isNullOrEmptyOrUndefined(settings.relativeTemplatePath)) {
			Utils.printAsGitHubError("The relative pr sync template file path cannot be null or empty.");
			Deno.exit(1);
		}

		template = template.replace(/(?:\r\n|\r|\n)/g, "\n");

		const fileDataLines: string[] = template.split("\n");

		for (let i = 0; i < fileDataLines.length; i++) {
			const line = fileDataLines[i];

			const isInSyncLine = line.match(this.isInSyncLineRegex) != null;

			console.log(`Current Line(${isInSyncLine}): ${line}`);

			// If the line is a sync line with any sync status
			if (isInSyncLine) {
				if (line.match(this.validIssueNum)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.issueNumValid);
				} else if (line.match(this.titleRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.titleInSync);
				} else if (line.match(this.defaultReviewerRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.defaultReviewerInSync);
				} else if (line.match(this.assigneesRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.assigneesInSync);
				} else if (line.match(this.labelsRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.labelsInSync);
				} else if (line.match(this.projectsRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.projectsInSync);
				} else if (line.match(this.milestoneRegex)) {
					fileDataLines[i] = this.setLineSyncStatus(line, settings.milestoneInSync);
				} else if (line.match(this.syncEnabledRegex)) {
					
				} else if (line.match(this.syncDisabledRegex)) {
				}
			}
		}

		let templateResult = fileDataLines.join("\n");

		templateResult = this.processIssueNumVars(templateResult, settings.issueNumber);
		templateResult = this.processHeadBranchVars(templateResult, settings.headBranch);

		return templateResult;
	}

	public processIssueNumVars(template: string, issueNumber: number): string {
		const funcName = "processIssueNumVars";
		Guard.isNullOrEmptyOrUndefined(template, funcName, "template");
		Guard.isLessThanOne(issueNumber, funcName, "issueNumber");

		return template.replace(this.issueNumVarRegex, issueNumber.toString());
	}

	public processHeadBranchVars(template: string, headBranch: string): string {
		const funcName = "processHeadBranchVars";
		Guard.isNullOrEmptyOrUndefined(template, funcName, "template");
		Guard.isNullOrEmptyOrUndefined(headBranch, funcName, "headBranch");

		return template.replace(this.headBranchVarRegex, headBranch);
	}

	private lineItemShowsInSync(lineItem: string): boolean {
		return lineItem.match(this.syncEnabledRegex) !== null;
	}

	private isLineInSync(line: string): boolean {
		return line.match(this.lineInSyncRegex) != null && line.match(this.lineOutOfSyncRegex) === null;
	}

	private setLineSyncStatus(line: string, settingSyncStatus: boolean): string {
		const lineIsInSync = this.isLineInSync(line);
		const settingNotInSync = !settingSyncStatus;

		return lineIsInSync && settingNotInSync
			? line.replace(/✅/g, "❌")
			: line.replace(/❌/g, "✅");
	}
}

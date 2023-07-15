import { RepoClient } from "../clients/RepoClient.ts";
import { Guard } from "./Guard.ts";
import { IPRTemplateSettings } from "./IPRTemplateSettings.ts";
import { GitHubVariableService } from "./Services/GitHubVariableService.ts";
import { Utils } from "./Utils.ts";

/**
 * Manages the pull request template.
 */
export class PRTemplateManager {
	private readonly baseBranchRegex = /<!--base-branch-->/gm;
	private readonly headBranchRegex = /<!--head-branch-->/gm;
	private readonly validIssueNumRegex = /<!--valid-issue-number-->/gm;
	private readonly titleRegex = /<!--title-->/gm;
	private readonly assigneesRegex = /<!--assignees-->/gm;
	private readonly labelsRegex = /<!--labels-->/gm;
	private readonly projectsRegex = /<!--projects-->/gm;
	private readonly milestoneRegex = /<!--milestone-->/gm;
	private readonly issueNumTemplateVarRegex = /\${{\s*issue-number\s*}}/gm;
	private readonly branchesTemplateVarRegex = /\${{\s*branches\s*}}/gm;
	private readonly syncFlagRegex = /<!--sync-flag-->/gm;
	private readonly syncEmptyCheckRegex = /- \[ \] /gm;
	private readonly syncFullCheckRegex = /- \[(x|X)\] /gm;
	private readonly isInSyncLineRegex = /(✅|❌) .+<!--.+-->/gm;
	private readonly lineInSyncRegex = /✅ .+<!--.+-->/gm;
	private readonly lineOutOfSyncRegex = /❌ .+<!--.+-->/gm;
	private readonly repoClient: RepoClient;
	private readonly githubRepoService: GitHubVariableService | undefined;

	/**
	 * Initializes a new instance of the {@link PRTemplateManager} class.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repository.
	 * @param token The GitHub token to use for authentication.
	 */
	constructor(orgName: string, repoName: string, token?: string) {
		this.repoClient = new RepoClient(token);

		if (!Utils.isNullOrEmptyOrUndefined(token)) {
			this.githubRepoService = new GitHubVariableService(orgName, repoName, token);
		}
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

		const allowedPRBaseBranches = await this.getAllowedPRBaseBranches();

		let baseBranchesText = "";

		switch (allowedPRBaseBranches.length) {
			case 1:
				baseBranchesText = `the branch '${allowedPRBaseBranches[0]}'`;
				break;
			case 2:
				baseBranchesText = `a '${allowedPRBaseBranches[0]}' or '${allowedPRBaseBranches[1]}' branch.`;
				break;
			default: {
				// get all of the branches except the last one
				const allBranchesButLast = allowedPRBaseBranches.slice(0, allowedPRBaseBranches.length - 1);
				const lastBranch = allowedPRBaseBranches[allowedPRBaseBranches.length - 1];

				baseBranchesText = `a '${allBranchesButLast.join("', '")}', or '${lastBranch}' branch.`;
				break;
			}
		}

		templatedData = templatedData.replace(this.branchesTemplateVarRegex, baseBranchesText);

		return templatedData;
	}

	/**
	 * Processes the given {@link template} with the given {@link settings}.
	 * @param template The template to process.
	 * @param settings The various settings to use for processing the template.
	 * @returns The template after processing as well as a list of items synced.
	 */
	public processSyncTemplate(template: string, settings: IPRTemplateSettings): [string, string[]] {
		Guard.isNullOrEmptyOrUndefined(template, "processSyncTemplate", "template");

		const statusOfSyncItems: string[] = [];

		template = template.replace(/(?:\r\n|\r|\n)/g, "\n");

		const fileDataLines: string[] = Utils.splitBy(template, "\n");

		for (let i = 0; i < fileDataLines.length; i++) {
			const line = fileDataLines[i];

			const isInSyncLine = line.match(this.isInSyncLineRegex) != null;

			// If the line is a sync line with any sync status
			if (isInSyncLine) {
				if (line.match(this.headBranchRegex)) {
					const statusEmoji = settings.headBranchValid ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The head branch is${settings.headBranchValid ? "" : " not"} valid.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.headBranchValid);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.baseBranchRegex)) {
					const statusEmoji = settings.baseBranchValid ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The base branch is${settings.baseBranchValid ? "" : " not"} valid.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.baseBranchValid);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.validIssueNumRegex)) {
					const statusEmoji = settings.issueNumValid ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The issue number is${settings.issueNumValid ? "" : " not"} valid.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.issueNumValid);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.titleRegex)) {
					const statusEmoji = settings.titleInSync ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The title is${settings.titleInSync ? "" : " not"} in sync.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.titleInSync);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.assigneesRegex)) {
					const statusEmoji = settings.assigneesInSync ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The assignees are${settings.assigneesInSync ? "" : " not"} in sync.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.assigneesInSync);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.labelsRegex)) {
					const statusEmoji = settings.labelsInSync ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The labels are${settings.labelsInSync ? "" : " not"} in sync.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.labelsInSync);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.projectsRegex)) {
					const statusEmoji = settings.projectsInSync ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The projects are${settings.projectsInSync ? "" : " not"} in sync.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.projectsInSync);

					statusOfSyncItems.push(statusMsg);
				} else if (line.match(this.milestoneRegex)) {
					const statusEmoji = settings.milestoneInSync ? "✅" : "❌";
					const statusMsg = `${statusEmoji}The milestone is${settings.milestoneInSync ? "" : " not"} in sync.`;
					fileDataLines[i] = this.setLineSyncStatus(line, settings.milestoneInSync);

					statusOfSyncItems.push(statusMsg);
				}
			}
		}

		return [fileDataLines.join("\n"), statusOfSyncItems];
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

		const fileDataLines: string[] = Utils.splitBy(template, "\n");

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
		const assigneesSyntaxExists = template.match(this.assigneesRegex) != null;
		const labelsSyntaxExists = template.match(this.labelsRegex) != null;
		const projectsSyntaxExists = template.match(this.projectsRegex) != null;
		const milestoneSyntaxExists = template.match(this.milestoneRegex) != null;

		return baseBranchSyntaxExists &&
			headBranchSyntaxExists &&
			validIssueNumSyntaxExists &&
			titleSyntaxExists &&
			assigneesSyntaxExists &&
			labelsSyntaxExists &&
			projectsSyntaxExists &&
			milestoneSyntaxExists;
	}

	/**
	 * Gets the list of allowed base branches for a repository with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @returns The list of allowed base branches.
	 */
	public async getAllowedPRBaseBranches(): Promise<string[]> {
		const defaultBranches = ["main", "preview"];

		if (this.githubRepoService === undefined) {
			return defaultBranches;
		}
		
		// This repo variable is optional
		const prSyncBaseBranchesVarName = "PR_SYNC_BASE_BRANCHES";

		const prSyncBaseBranchListStr = await this.githubRepoService.getValue(prSyncBaseBranchesVarName, false);

		if (Utils.isNullOrEmptyOrUndefined(prSyncBaseBranchListStr)) {
			return defaultBranches;
		}

		const prSyncBaseBranches = Utils.splitByComma(prSyncBaseBranchListStr);

		return prSyncBaseBranches.length > 0 ? prSyncBaseBranches : defaultBranches;
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

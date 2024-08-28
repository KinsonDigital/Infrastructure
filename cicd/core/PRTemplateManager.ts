import { IPRTemplateSettings } from "./IPRTemplateSettings.ts";
import { MarkdownService } from "./Services/MarkdownService.ts";
import { Utils } from "./Utils.ts";

/**
 * Manages the pull request template.
 */
export class PRTemplateManager {
	private readonly syncFlagRegex = /<!--sync-flag-->/gm;
	private readonly syncEmptyCheckRegex = /- \[ \] /gm;
	private readonly syncFullCheckRegex = /- \[(x|X)\] /gm;
	private readonly markdownService: MarkdownService;

	/**
	 * Initializes a new instance of the {@link PRTemplateManager} class.
	 */
	constructor() {
		this.markdownService = new MarkdownService();
	}

	/**
	 * Creates a pull request sync template used to represent the state of the sync status.
	 * @param allowedPRBaseBranches The branches allowed as the base branch for a PR.
	 * @param issueNumber The issue number.
	 * @param settings The settings used to create the template to represent the sync status.
	 * @returns The pull request template.
	 */
	public createPrSyncTemplate(allowedPRBaseBranches: string[], issueNumber: number, settings: IPRTemplateSettings): string {
		let result = this.buildDescriptionSection(allowedPRBaseBranches, issueNumber, settings);

		result += "\n\n---\n\n";
		result += this.createAdditionalInfo();
		result += "\n\n---\n\n";
		result += this.createSyncCheckBox();

		return result;
	}

	/**
	 * Returns a value indicating whether or not syncing is disabled in the template.
	 * @param template The template to check.
	 * @returns True if syncing is disabled, false otherwise.
	 */
	public syncingDisabled(template: string): boolean {
		if (Utils.isNothing(template)) {
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
	 * Builds the description section of the pull request template.
	 * @param allowedPRBaseBranches The allowed base branches for a pull request.
	 * @param issueNumber The issue number.
	 * @param settings The settings used to create the template to represent the sync status.
	 * @returns The complete description section.
	 */
	private buildDescriptionSection(allowedPRBaseBranches: string[], issueNumber: number, settings: IPRTemplateSettings): string {
		let descriptionSection = this.markdownService.createHeader("Description:", 3, true);

		descriptionSection +=
			"\n\nTo allow this pull request to be merged, please make sure that the following items of this pull request are complete.";
		descriptionSection += "\n";
		descriptionSection += `\nThis pull request closes #${issueNumber}`;
		descriptionSection += "\n\n";
		descriptionSection += this.createStatusList(allowedPRBaseBranches, settings);

		return descriptionSection;
	}

	/**
	 * Creates the status list for the pull request template.
	 * @param allowedPRBaseBranches The allowed base branches for a pull request.
	 * @param settings The settings used to create the template to represent the sync status.
	 * @returns The complete status list.
	 */
	private createStatusList(allowedPRBaseBranches: string[], settings: IPRTemplateSettings): string {
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

		const statusLines: string[] = [];

		let statusEmoji = settings.headBranchValid ? "✅" : "❌";
		let headBranchStatus = `${statusEmoji}The pull request head branch must be a feature branch `;
		headBranchStatus += `with the syntax 'feature/<issue-num>-sync-testing'.  `;
		statusLines.push(headBranchStatus);

		statusEmoji = settings.baseBranchValid ? "✅" : "❌";
		statusLines.push(`${statusEmoji}The pull request base branch must be ${baseBranchesText}.  `);

		statusEmoji = settings.issueNumValid ? "✅" : "❌";
		statusLines.push(`${statusEmoji}The pull request head branch contains a valid issue number.  `);

		statusEmoji = settings.titleInSync ? "✅" : "❌";
		statusLines.push(`${statusEmoji}The pull request title matches the linked issue title exactly.  `);

		statusEmoji = settings.assigneesInSync ? "✅" : "❌";
		statusLines.push(`${statusEmoji}The pull request assignees match the assignees of the issue.  `);

		statusEmoji = settings.labelsInSync ? "✅" : "❌";
		statusLines.push(`${statusEmoji}The pull request labels match the labels of the issue.  `);

		statusEmoji = settings.projectsInSync ? "✅" : "❌";
		let projectsInSyncStatus = `${statusEmoji}The pull request organizational projects match the `;
		projectsInSyncStatus += `organizational projects of the issue.  `;
		statusLines.push(projectsInSyncStatus);

		statusEmoji = settings.milestoneInSync ? "✅" : "❌";
		statusLines.push(`${statusEmoji}The pull requests milestone matches the milestone of the issue.  `);

		return statusLines.join("\n");
	}

	/**
	 * Creates the additional info section of the pull request template.
	 * @returns The additional info section.
	 */
	private createAdditionalInfo(): string {
		let result = this.markdownService.createHeader("Additional Info:", 3, true);
		result += "\n1. Pull requests are automatically synced with the associated issue upon creation by ";
		result += "one of the KinsonDigital workflow bots. ";

		result += "\n2. The associated issue is the issue number that is embedded in the pull request head branch.";

		result += "\n3. The list above will be automatically updated as the pull request's various settings match ";
		result += "or do not match the associated issue.";

		result += "\n4. To manually sync the pull request to the issue, create a comment with the `[run-sync]` command.";
		result += "\n> [!Note] You must be an admin member of the organization to use this command.";

		return result;
	}

	/**
	 * Creates the sync status checkbox.
	 * @returns The sync status checkbox.
	 */
	private createSyncCheckBox(): string {
		let text = "Sync with the issue.  Use this to enable or disable this pull request from ";
		text += "syncing with its associated issue.";

		return this.markdownService.createCheckBox(text, true);
	}
}

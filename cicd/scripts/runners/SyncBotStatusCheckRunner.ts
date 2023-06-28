import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { IssueClient } from "../../clients/IssueClient.ts";
import { ProjectClient } from "../../clients/ProjectClient.ts";
import { PullRequestClient } from "../../clients/PullRequestClient.ts";
import { EventType } from "../../core/Types.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { UsersClient } from "../../clients/UsersClient.ts";
import { IPullRequestModel } from "../../core/Models/IPullRequestModel.ts";
import { IIssueModel } from "../../core/Models/IIssueModel.ts";
import { IProjectModel } from "../../core/Models/IProjectModel.ts";
import { IIssueOrPRRequestData } from "../../core/IIssueOrPRRequestData.ts";
import { IPRTemplateSettings } from "../../core/IPRTemplateSettings.ts";
import { PRTemplateManager } from "../../core/PRTemplateManager.ts";
import { IssueState } from "../../core/Enums.ts";

/**
 * Runs as a sync bot and a pull request status check.
 */
export class SyncBotStatusCheckRunner extends ScriptRunner {
	private issueClient: IssueClient;
	private projClient: ProjectClient;
	private prClient: PullRequestClient;
	private repoClient: RepoClient;
	private userClient: UsersClient;
	private issue: IIssueModel | null = null;
	private pr: IPullRequestModel | null = null;
	private issueProjects: IProjectModel[] | null = null;
	private prProjects: IProjectModel[] | null = null;
	private readonly organization: string = "KinsonDigital";

	/**
	 * Initializes a new instance of the {@link SyncBotStatusCheckRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[], scriptName: string) {
		if (args.length != 4) {
			const argInfos: string[] = [];

			for (let i = 0; i < args.length - 1; i++) {
				argInfos.push(`${Utils.toOrdinal(i + 1)} Arg: $`);
			}

			argInfos[0] = argInfos[0]
				.replace("$", "Required and must be a valid GitHub repository name.");
			argInfos[1] = argInfos[1]
				.replace("$", "Required and must be a valid issue or pull request number.");
			argInfos[2] = argInfos[2]
				.replace("$", "Required and must be a valid case-insensitive workflow event type of 'issue' or 'pr'.");
			argInfos[3] = argInfos[3].replace("$", "Required and must be a valid GitHub token.");

			argInfos.unshift(`The ${scriptName} cicd script must have 4 arguments.`);

			Utils.printAsGitHubError(argInfos.join("\n"));
			Deno.exit(1);
		}

		super(args);

		const githubToken = args[args.length - 1];
		this.repoClient = new RepoClient(githubToken);
		this.issueClient = new IssueClient(githubToken);
		this.projClient = new ProjectClient(githubToken);
		this.prClient = new PullRequestClient(githubToken);
		this.userClient = new UsersClient(githubToken);
	}

	/**
	 * Runs the sync status check script.
	 */
	public async run(): Promise<void> {
		await super.run();

		const [repoName, issueOrPrNumber, eventType, githubToken] = this.args;

		Utils.printInGroup("Script Arguments", [
			`Repo Name (Required): ${repoName}`,
			`${eventType === "issue" ? "Issue" : "Pull Request"} Number (Required): ${issueOrPrNumber}`,
			`Event Type (Required): ${eventType}`,
			`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(githubToken) ? "Not Provided" : "****"}`,
		]);

		if (!(await this.repoClient.repoExists(repoName))) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		const DEFAULT_PR_REVIEWER = "DEFAULT_PR_REVIEWER";
		const problemsFound: string[] = [];
		let issueNumber = 0;
		let prNumber = 0;

		const repoVars = await this.repoClient.getVariables(repoName);
		const defaultReviewerVar = repoVars.find((v) => v.name == DEFAULT_PR_REVIEWER);

		// Make sure that the repo contains the default PR reviewer variable
		if (defaultReviewerVar == undefined) {
			let errorMsg = `The repository '${repoName}' does not have a variable named '${DEFAULT_PR_REVIEWER}'.`;
			errorMsg += "\nThe value of this variable must be a valid GitHub user.";

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const defaultReviewer = defaultReviewerVar.value;

		if (!(await this.userClient.userExists(defaultReviewer))) {
			const errorMsg = `The GitHub user '${defaultReviewer}' for the default pull request reviewer does not exist.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		if (eventType === "issue") {
			issueNumber = Number.parseInt(issueOrPrNumber);

			if (!(await this.issueClient.openIssueExists(repoName, issueNumber))) {
				problemsFound.push(`The issue '${issueNumber}' does not exist.`);
			} else {
				// Get the pull request number by parsing the pr metadata in the issue description
				const closedByPRRegex = /<!--closed-by-pr:[0-9]+-->/gm;
				const issueDescription = (await this.getIssue(repoName, issueNumber)).body;
				const prLinkMetaData = issueDescription.match(closedByPRRegex);

				if (prLinkMetaData === null) {
					let noticeMsg = `The issue '${issueNumber}' does not contain any pull request metadata.`;
					noticeMsg += "\n\nThe expected metadata should come in the form of '<!--closed-by-pr:[0-9]+-->'";
					noticeMsg += `Issue: ${Utils.buildIssueUrl(this.organization, repoName, issueNumber)}`;

					Utils.printAsGitHubNotice(noticeMsg);
					Deno.exit(0);
				} else {
					prNumber = Number.parseInt((<RegExpMatchArray> prLinkMetaData[0].match(/[0-9]+/gm))[0]);
				}
			}
		} else { // Run as a status check
			prNumber = Number.parseInt(issueOrPrNumber);

			if (!(await this.prClient.pullRequestExists(repoName, prNumber))) {
				problemsFound.push(`The pull request '${prNumber}' does not exist.`);
			} else {
				const headBranch = (await this.getPullRequest(repoName, prNumber)).head.ref;
				const headBranchNotValid = Utils.isNotFeatureBranch(headBranch);

				// If the head branch is not a preview branch, no sync check is required. Just exit.
				if (headBranchNotValid) {
					let noticeMsg = `The head branch '${headBranch}' is not a feature branch.`;
					noticeMsg += "\nSync checks and processing ignored.";

					Utils.printAsGitHubNotice(noticeMsg);
					Deno.exit(0);
				} else {
					issueNumber = Number.parseInt((<RegExpMatchArray> headBranch.match(/[0-9]+/gm))[0]);
				}
			}
		}

		const prTemplateManager = new PRTemplateManager(githubToken);
		const prTemplate = (await this.getPullRequest(repoName, prNumber)).body;
		const syncingDisabled = prTemplateManager.syncingDisabled(prTemplate);

		// Syncing is disabled or the PR body does not contain a sync template
		if (syncingDisabled) {
			let syncDisabledMsg = `Syncing for pull request '${prNumber}' is disabled.`;
			syncDisabledMsg += "\nMake sure that the pull request description contains a valid PR sync template";
			syncDisabledMsg += "\n and make sure that syncing is enabled by checking the 'Sync with the issue' checkbox.";
			syncDisabledMsg += `\nPR: ${Utils.buildPullRequestUrl(this.organization, repoName, prNumber)}`;

			Utils.printAsGitHubNotice(syncDisabledMsg);
			Deno.exit(0);
		}

		if (eventType === "issue") {
			await this.runAsSyncBot(repoName, defaultReviewer, issueNumber, prNumber);
		} else {
			problemsFound.push(...await this.runAsStatusCheck(repoName, defaultReviewer, issueNumber, prNumber));
		}

		const prUrl = `\nIssue: ${Utils.buildIssueUrl(this.organization, repoName, issueNumber)}`;
		const issueUrl = `\nPull Request: ${Utils.buildPullRequestUrl(this.organization, repoName, prNumber)}`;

		let successMsg = `✅No problems found. Issue '${issueNumber}' synced with pull request '${prNumber}'.`;
		successMsg += prUrl;
		successMsg += issueUrl;

		let failureMsg = `❌Issue '${issueNumber}' is not fully synced with pull request '${prNumber}'❌`;
		failureMsg += prUrl;
		failureMsg += issueUrl;

		Utils.printEmptyLine();
		Utils.printProblemList(problemsFound, successMsg, failureMsg);

		if (problemsFound.length > 0) {
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected validateArgs(args: string[]): void {
		args = args.map((arg) => arg.trim());

		const issueOrPRNumberStr = args[1];
		const eventType = args[3];

		if (!Utils.isNumeric(issueOrPRNumberStr)) {
			Utils.printAsGitHubError(`The ${eventType} number '${issueOrPRNumberStr}' is not a valid number.`);
			Deno.exit(1);
		}

		if (!this.isValidEventType(eventType)) {
			let errorMsg = `The event type '${eventType}' is not valid.`;
			errorMsg += `\nThe event type must be either 'issue' or 'pr' case-insensitive value.`;

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
	}

	/**
	 * Runs the script as a sync bot.
	 * @param repoName The name of the repository.
	 * @param defaultReviewer The default pull request reviewer.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 */
	private async runAsSyncBot(repoName: string, defaultReviewer: string, issueNumber: number, prNumber: number): Promise<void> {
		await this.syncPullRequestToIssue(repoName, prNumber, issueNumber);
		await this.updatePRBody(repoName, issueNumber, prNumber, defaultReviewer);
	}

	/**
	 * Runs the script as a status check.
	 * @param repoName The name of the repository.
	 * @param defaultReviewer The default pull request reviewer.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @returns The list of problems found.
	 */
	private async runAsStatusCheck(
		repoName: string,
		defaultReviewer: string,
		issueNumber: number,
		prNumber: number,
	): Promise<string[]> {
		const problemsFound: string[] = [];
		const issueTitle = (await this.getIssue(repoName, issueNumber)).title;
		const prTitle = (await this.getPullRequest(repoName, prNumber)).title;
		const prHeadBranch = (await this.getPullRequest(repoName, prNumber)).head.ref;
		const prBaseBranch = (await this.getPullRequest(repoName, prNumber)).base.ref;

		const templateSettings = await this.buildTemplateSettings(repoName, defaultReviewer, issueNumber, prNumber);

		await this.updatePRBody(repoName, issueNumber, prNumber, defaultReviewer);

		problemsFound.push(...this.buildProblemsList(
			templateSettings,
			issueTitle ?? "",
			prTitle ?? "",
			defaultReviewer,
			prHeadBranch,
			prBaseBranch,
		));

		Utils.printAsGitHubNotice(`✅The issue '${issueNumber}' and pull request '${prNumber}' sync status has been updated✅.`);

		return problemsFound;
	}

	/**
	 * Builds the pull request sync template settings for processing the template to show the sync status
	 * between the pull request and the issue.
	 * @param repoName The name of the repository.
	 * @param defaultReviewer The default pull request reviewer.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @returns The template settings to use for processing the pull request sync template.
	 */
	private async buildTemplateSettings(
		repoName: string,
		defaultReviewer: string,
		issueNumber: number,
		prNumber: number,
	): Promise<IPRTemplateSettings> {
		const issueProjects: IProjectModel[] = await this.getIssueOrgProjects(repoName, issueNumber);
		const prProjects: IProjectModel[] = await this.getPullRequestOrgProjects(repoName, prNumber);

		const issueTitle = (await this.getIssue(repoName, issueNumber)).title;
		const issueAssignees = (await this.getIssue(repoName, issueNumber)).assignees;
		const issueLabels = (await this.getIssue(repoName, issueNumber)).labels;
		const issueMilestone = (await this.getIssue(repoName, issueNumber)).milestone;

		const prTitle = (await this.getPullRequest(repoName, prNumber)).title;
		const prAssignees = (await this.getPullRequest(repoName, prNumber)).assignees;
		const prLabels = (await this.getPullRequest(repoName, prNumber)).labels;
		const prMilestone = (await this.getPullRequest(repoName, prNumber)).milestone;
		const prHeadBranch = (await this.getPullRequest(repoName, prNumber)).head.ref;
		const prBaseBranch = (await this.getPullRequest(repoName, prNumber)).base.ref;
		const prRequestedReviewers = (await this.getPullRequest(repoName, prNumber)).requested_reviewers;

		const headBranchIsValid = Utils.isFeatureBranch(prHeadBranch);
		const baseBranchIsValid = prBaseBranch === "master" || prBaseBranch === "preview";

		const titleInSync = prTitle?.trim() === issueTitle?.trim();
		const defaultReviewerIsValid = prRequestedReviewers.some((r) => r.login === defaultReviewer);

		const assigneesInSync = Utils.assigneesMatch(issueAssignees, prAssignees);
		const labelsInSync = Utils.labelsMatch(issueLabels, prLabels);

		const milestoneInSync = issueMilestone?.number === prMilestone?.number;
		const projectsInSync = Utils.orgProjectsMatch(issueProjects, prProjects);

		const templateSettings: IPRTemplateSettings = {};
		templateSettings.issueNumber = issueNumber;
		templateSettings.headBranchValid = headBranchIsValid;
		templateSettings.baseBranchValid = baseBranchIsValid;
		templateSettings.issueNumValid = true;
		templateSettings.titleInSync = titleInSync;
		templateSettings.defaultReviewerValid = defaultReviewerIsValid;
		templateSettings.assigneesInSync = assigneesInSync;
		templateSettings.labelsInSync = labelsInSync;
		templateSettings.projectsInSync = projectsInSync;
		templateSettings.milestoneInSync = milestoneInSync;

		return templateSettings;
	}

	/**
	 * @param repoName The name of the repository.
	 * @param issueNumber
	 * @returns
	 */
	private async getIssue(repoName: string, issueNumber: number): Promise<IIssueModel> {
		if (this.issue === null) {
			this.issue = await this.issueClient.getIssue(repoName, issueNumber);
		}

		return this.issue;
	}

	/**
	 * Gets a pull request from a repository with a name that matches the given {@link repoName}
	 * with a pull request number that matches the given {@link prNumber}.
	 * @param repoName The name of the repository.
	 * @param prNumber The pull request number.
	 * @returns The pull request.
	 * @remarks Caches the pull request on the first call.
	 */
	private async getPullRequest(repoName: string, prNumber: number): Promise<IPullRequestModel> {
		if (this.pr === null) {
			this.pr = await this.prClient.getPullRequest(repoName, prNumber);
		}

		return this.pr;
	}

	/**
	 * Gets a list of organization projects associated with an issue with the given {@link issueNumber} from a repository
	 * with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @returns The projects associated with the issue.
	 * @remarks Caches the projects on the first call.
	 */
	private async getIssueOrgProjects(repoName: string, issueNumber: number): Promise<IProjectModel[]> {
		if (this.issueProjects === null) {
			this.issueProjects = await this.projClient.getIssueProjects(repoName, issueNumber);
		}

		return this.issueProjects;
	}

	/**
	 * Gets a list of organization projects associated with a pull request with the given {@link issueNumber} from a repository
	 * with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @param prNumber The pull request number.
	 * @returns The projects associated with the pull request.
	 * @remarks Caches the projects on the first call.
	 */
	private async getPullRequestOrgProjects(repoName: string, prNumber: number): Promise<IProjectModel[]> {
		if (this.prProjects === null) {
			this.prProjects = await this.projClient.getPullRequestProjects(repoName, prNumber);
		}

		return this.prProjects;
	}

	/**
	 * Syncs a pull request with the given {@link prNumber} to an issue with the given {@link issueNumber} in a repository
	 * with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @param prNumber The pull request number.
	 * @param issueNumber The issue number.
	 */
	private async syncPullRequestToIssue(repoName: string, prNumber: number, issueNumber: number): Promise<void> {
		const issue = await this.getIssue(repoName, issueNumber);
		const issueLabels = issue.labels?.map((label) => label.name) ?? [];

		const pr = await this.getPullRequest(repoName, prNumber);
		const prTitle = pr.title;

		const prRequestData: IIssueOrPRRequestData = {
			title: prTitle,
			state: pr.state as IssueState,
			state_reason: null,
			assignees: issue.assignees?.map((i) => i.login) ?? [],
			labels: issueLabels,
			milestone: issue.milestone?.number ?? null,
		};

		await this.prClient.updatePullRequest(repoName, prNumber, prRequestData);
	}

	/**
	 * Updates the body pull request sync template of a pull request with the given {@link prNumber} in a repository
	 * with a name that matches the given {@link repoName} with the given {@link defaultReviewer}.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @param defaultReviewer The default pull request reviewer.
	 */
	private async updatePRBody(repoName: string, issueNumber: number, prNumber: number, defaultReviewer: string): Promise<void> {
		const prBody = (await this.getPullRequest(repoName, prNumber)).body;

		const templateSettings = await this.buildTemplateSettings(repoName, defaultReviewer, issueNumber, prNumber);
		const prTemplateManager = new PRTemplateManager();

		const [updatedPRDescription, statusOfSyncItems] = prTemplateManager.processSyncTemplate(prBody, templateSettings);

		const prRequestData: IIssueOrPRRequestData = {
			body: updatedPRDescription,
		};

		await this.prClient.updatePullRequest(repoName, prNumber, prRequestData);

		statusOfSyncItems.forEach((syncItemStatusMsg) => {
			Utils.printAsGitHubNotice(syncItemStatusMsg);
		});
	}

	/**
	 * Returns a value indicating whether or not the given {@link eventType} is valid.
	 * @param eventType The type of event.
	 * @returns True if the event type is valid, false otherwise.
	 */
	private isValidEventType(eventType: string): eventType is EventType {
		eventType = eventType.toLowerCase();

		return eventType === "issue" || eventType === "pr";
	}

	/**
	 * Creates a list of problems related to the given {@link templateSettings}.
	 * @param templateSettings The template settings.
	 * @param issueTitle The title of the issue.
	 * @param prTitle The title of the pull request.
	 * @param defaultReviewer The default reviewer of the pull request.
	 * @param prHeadBranch The head branch of the pull request.
	 * @param prBaseBranch The base branch of the pull request.
	 * @returns A list of problems related to the given {@link templateSettings}.
	 */
	private buildProblemsList(
		templateSettings: IPRTemplateSettings,
		issueTitle = "",
		prTitle = "",
		defaultReviewer = "",
		prHeadBranch = "",
		prBaseBranch = "",
	): string[] {
		const problems: string[] = [];

		if (!templateSettings.headBranchValid) {
			problems.push(`The head branch '${prHeadBranch}' is not a valid feature branch.`);
		}

		if (!templateSettings.baseBranchValid) {
			problems.push(`The base branch '${prBaseBranch}' is not a valid base branch.`);
		}

		if (!templateSettings.titleInSync) {
			problems.push(`The pr title '${prTitle}' does not match with the issue title '${issueTitle}'.`);
		}

		if (!templateSettings.defaultReviewerValid) {
			problems.push(`The pr default reviewer '${defaultReviewer}' is not valid or set.`);
		}

		if (!templateSettings.assigneesInSync) {
			problems.push(`The pr assignees do not match the issue assignees.`);
		}

		if (!templateSettings.labelsInSync) {
			problems.push(`The pr labels do not match the issue labels.`);
		}

		if (!templateSettings.milestoneInSync) {
			problems.push(`The pr milestone does not match the issue milestone.`);
		}

		if (!templateSettings.projectsInSync) {
			problems.push(`The pr projects do not match the issue projects.`);
		}

		return problems;
	}
}

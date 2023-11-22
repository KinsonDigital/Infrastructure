import { IssueClient, OrgClient, ProjectClient, PullRequestClient, RepoClient } from "../../../deps.ts";
import { IssueModel, ProjectModel, PullRequestModel } from "../../../deps.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { EventType, GitHubLogType, IssueState } from "../../core/Enums.ts";
import { IIssueOrPRRequestData } from "../../core/IIssueOrPRRequestData.ts";
import { IPRTemplateSettings } from "../../core/IPRTemplateSettings.ts";
import { PRTemplateManager } from "../../core/PRTemplateManager.ts";
import { GitHubVariableService } from "../../core/Services/GitHubVariableService.ts";

/**
 * Runs as a sync bot and a pull request status check.
 */
export class SyncBotStatusCheckRunner extends ScriptRunner {
	private readonly prTemplateManager: PRTemplateManager;
	private readonly issueClient: IssueClient;
	private readonly projClient: ProjectClient;
	private readonly prClient: PullRequestClient;
	private readonly githubVarService: GitHubVariableService;
	private issue: IssueModel | null = null;
	private pr: PullRequestModel | null = null;
	private issueProjects: ProjectModel[] | null = null;
	private prProjects: ProjectModel[] | null = null;

	/**
	 * Initializes a new instance of the {@link SyncBotStatusCheckRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[]) {
		super(args);

		const [ownerName, repoName, , , token] = args;

		this.prTemplateManager = new PRTemplateManager();
		this.issueClient = new IssueClient(ownerName, repoName, token);
		this.projClient = new ProjectClient(ownerName, repoName, token);
		this.prClient = new PullRequestClient(ownerName, repoName, token);
		this.githubVarService = new GitHubVariableService(ownerName, repoName, token);
	}

	/**
	 * Runs the sync status check script.
	 */
	public async run(): Promise<void> {
		await super.run();

		const [ownerName, repoName, issueOrPrNumber, eventTypeStr] = this.args;

		this.githubVarService.setOrgAndRepo(ownerName, repoName);

		const problemsFound: string[] = [];
		let issueNumber = 0;
		let prNumber = 0;

		const eventType = <EventType> eventTypeStr.toLowerCase();

		if (eventType === EventType.issue) {
			issueNumber = Number.parseInt(issueOrPrNumber);

			if (!(await this.issueClient.openIssueExists(issueNumber))) {
				problemsFound.push(`The issue '${issueNumber}' does not exist.`);
			} else {
				// Get the pull request number by parsing the pr metadata in the issue description
				const closedByPRRegex = /<!--closed-by-pr:[0-9]+-->/gm;
				const issueDescription = (await this.getIssue(issueNumber)).body;
				const prLinkMetaData = issueDescription.match(closedByPRRegex);

				if (prLinkMetaData === null) {
					let noticeMsg = `The issue '${issueNumber}' does not contain any pull request metadata.`;
					noticeMsg += "\n\nThe expected metadata should come in the form of '<!--closed-by-pr:[0-9]+-->'";
					noticeMsg += `Issue: ${Utils.buildIssueUrl(ownerName, repoName, issueNumber)}`;

					Utils.printAsGitHubNotice(noticeMsg);
					Deno.exit(0);
				} else {
					prNumber = Number.parseInt((<RegExpMatchArray> prLinkMetaData[0].match(/[0-9]+/gm))[0]);
				}
			}
		} else { // Run as a status check
			prNumber = Number.parseInt(issueOrPrNumber);

			if (!(await this.prClient.pullRequestExists(prNumber))) {
				problemsFound.push(`The pull request '${prNumber}' does not exist.`);
			} else {
				const headBranch = (await this.getPullRequest(prNumber)).head.ref;
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

		const prTemplate = (await this.getPullRequest(prNumber)).body;
		const syncingDisabled = this.prTemplateManager.syncingDisabled(prTemplate);

		// Syncing is disabled or the PR body does not contain a sync template
		if (syncingDisabled) {
			let syncDisabledMsg = `Syncing for pull request '${prNumber}' is disabled.`;
			syncDisabledMsg += "\nMake sure that the pull request description contains a valid PR sync template";
			syncDisabledMsg += "\n and make sure that syncing is enabled by checking the 'Sync with the issue' checkbox.";
			syncDisabledMsg += `\nPR: ${Utils.buildPullRequestUrl(ownerName, repoName, prNumber)}`;

			Utils.printAsGitHubNotice(syncDisabledMsg);
			Deno.exit(0);
		}

		if (eventTypeStr === EventType.issue) {
			await this.runAsSyncBot(issueNumber, prNumber);
		} else {
			problemsFound.push(...await this.runAsStatusCheck(issueNumber, prNumber));
		}

		const prUrl = `\nIssue: ${Utils.buildIssueUrl(ownerName, repoName, issueNumber)}`;
		const issueUrl = `\nPull Request: ${Utils.buildPullRequestUrl(ownerName, repoName, prNumber)}`;

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
	protected async validateArgs(args: string[]): Promise<void> {
		if (args.length != 5) {
			const mainMsg = `The cicd script must have 5 arguments but has ${args.length} argument(s).`;

			const argDescriptions = [
				"Required and must be a valid GitHub user name that is the owner of the repository.",
				"Required and must be a valid GitHub repository name.",
				"Required and must be a valid issue or pull request number.",
				"Required and must be a valid case-insensitive workflow event type of 'issue' or 'pr'.",
				"Required and must be a GitHub PAT (Personal Access Token).",
			];

			Utils.printAsGitHubError(mainMsg);
			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.normal);
			Deno.exit(1);
		}

		args = args.map((arg) => arg.trim());

		let [ownerName, repoName, issueOrPRNumberStr, eventType] = args;

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

		ownerName = ownerName.trim();
		const orgClient = new OrgClient(ownerName, this.token);

		// If the org does not exist
		if (!(await orgClient.exists())) {
			Utils.printAsGitHubError(`The organization '${ownerName}' does not exist.`);
			Deno.exit(1);
		}

		repoName = repoName.trim();
		const repoClient = new RepoClient(ownerName, repoName, this.token);

		// If the repo does not exist
		if (!(await repoClient.exists())) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [ownerName, repoName, issueOrPrNumber, eventType, githubToken] = args;

		ownerName = ownerName.trim();
		repoName = repoName.trim();
		issueOrPrNumber = issueOrPrNumber.trim();
		eventType = eventType.trim().toLowerCase();
		githubToken = githubToken.trim();

		return [ownerName, repoName, issueOrPrNumber, eventType, githubToken];
	}

	/**
	 * Runs the script as a sync bot.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 */
	private async runAsSyncBot(issueNumber: number, prNumber: number): Promise<void> {
		await this.syncPullRequestToIssue(prNumber, issueNumber);
		await this.updatePRBody(issueNumber, prNumber);
	}

	/**
	 * Runs the script as a status check.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @returns The list of problems found.
	 */
	private async runAsStatusCheck(
		issueNumber: number,
		prNumber: number,
	): Promise<string[]> {
		const problemsFound: string[] = [];
		const issueTitle = (await this.getIssue(issueNumber)).title;
		const prTitle = (await this.getPullRequest(prNumber)).title;
		const prHeadBranch = (await this.getPullRequest(prNumber)).head.ref;
		const prBaseBranch = (await this.getPullRequest(prNumber)).base.ref;

		const templateSettings = await this.buildTemplateSettings(issueNumber, prNumber);

		await this.updatePRBody(issueNumber, prNumber);

		problemsFound.push(...this.buildProblemsList(
			templateSettings,
			issueTitle ?? "",
			prTitle ?? "",
			prHeadBranch,
			prBaseBranch,
		));

		Utils.printAsGitHubNotice(`✅The issue '${issueNumber}' and pull request '${prNumber}' sync status has been updated✅.`);

		return problemsFound;
	}

	/**
	 * Builds the pull request sync template settings for processing the template to show the sync status
	 * between the pull request and the issue.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @returns The template settings to use for processing the pull request sync template.
	 */
	private async buildTemplateSettings(issueNumber: number, prNumber: number): Promise<IPRTemplateSettings> {
		const issueProjects: ProjectModel[] = await this.getIssueOrgProjects(issueNumber);
		const prProjects: ProjectModel[] = await this.getPullRequestOrgProjects(prNumber);

		const issueTitle = (await this.getIssue(issueNumber)).title;
		const issueAssignees = (await this.getIssue(issueNumber)).assignees;
		const issueLabels = (await this.getIssue(issueNumber)).labels;
		const issueMilestone = (await this.getIssue(issueNumber)).milestone;

		const pr = await this.prClient.getPullRequest(prNumber);
		const prTitle = pr.title;
		const prAssignees = pr.assignees;
		const prLabels = pr.labels;
		const prMilestone = pr.milestone;
		const prHeadBranch = pr.head.ref;
		const prBaseBranch = pr.base.ref;

		const allowedPRBaseBranches = await this.getAllowedPRBaseBranches();

		const headBranchIsValid = Utils.isFeatureBranch(prHeadBranch);
		const baseBranchIsValid = allowedPRBaseBranches.some((branch) => branch === prBaseBranch);

		const titleInSync = prTitle?.trim() === issueTitle?.trim();

		const assigneesInSync = Utils.assigneesMatch(issueAssignees, prAssignees);
		const labelsInSync = Utils.labelsMatch(issueLabels, prLabels);

		const milestoneInSync = issueMilestone?.number === prMilestone?.number;
		const projectsInSync = Utils.orgProjectsMatch(issueProjects, prProjects);

		const templateSettings: IPRTemplateSettings = {
			issueNumber: issueNumber,
			headBranchValid: headBranchIsValid,
			baseBranchValid: baseBranchIsValid,
			issueNumValid: true,
			titleInSync: titleInSync,
			assigneesInSync: assigneesInSync,
			labelsInSync: labelsInSync,
			projectsInSync: projectsInSync,
			milestoneInSync: milestoneInSync,
		};

		return templateSettings;
	}

	/**
	 * Gets an issue from a repository that matches the given {@link issueNumber }.
	 * @param issueNumber
	 * @returns { Promise<IssueModel> } The issue.
	 */
	private async getIssue(issueNumber: number): Promise<IssueModel> {
		if (this.issue === null) {
			this.issue = await this.issueClient.getIssue(issueNumber);
		}

		return this.issue;
	}

	/**
	 * Gets a pull request from a repository with a name that matches the given {@link repoName}
	 * with a pull request number that matches the given {@link prNumber}.
	 * @param prNumber The pull request number.
	 * @returns The pull request.
	 * @remarks Caches the pull request on the first call.
	 */
	private async getPullRequest(prNumber: number): Promise<PullRequestModel> {
		if (this.pr === null) {
			this.pr = await this.prClient.getPullRequest(prNumber);
		}

		return this.pr;
	}

	/**
	 * Gets the list of allowed base branches for a repository with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @returns The list of allowed base branches.
	 */
	private async getAllowedPRBaseBranches(): Promise<string[]> {
		// This repo variable is optional
		const prSyncBaseBranchesVarName = "PR_SYNC_BASE_BRANCHES";
		const defaultBranches = ["main", "preview"];

		const prSyncBranchesStr = await this.githubVarService.getValue(prSyncBaseBranchesVarName, false);

		if (Utils.isNothing(prSyncBranchesStr)) {
			let warningMsg = "The optional variable 'PR_SYNC_BASE_BRANCHES' does not exist or contains no value.";
			warningMsg += `\nUsing the default branches: ${defaultBranches.join(", ")}.`;
			Utils.printAsGitHubWarning(warningMsg);

			return defaultBranches;
		}

		const prSyncBaseBranches = Utils.splitByComma(prSyncBranchesStr);

		return prSyncBaseBranches.length > 0 ? prSyncBaseBranches : defaultBranches;
	}

	/**
	 * Gets a list of organization projects associated with an issue with the given {@link issueNumber} from a repository
	 * with a name that matches the given {@link repoName}.
	 * @param issueNumber The issue number.
	 * @returns The projects associated with the issue.
	 * @remarks Caches the projects on the first call.
	 */
	private async getIssueOrgProjects(issueNumber: number): Promise<ProjectModel[]> {
		if (this.issueProjects === null) {
			this.issueProjects = await this.projClient.getIssueProjects(issueNumber);
		}

		return this.issueProjects;
	}

	/**
	 * Gets a list of organization projects associated with a pull request with the given {@link issueNumber} from a repository
	 * with a name that matches the given {@link repoName}.
	 * @param prNumber The pull request number.
	 * @returns The projects associated with the pull request.
	 * @remarks Caches the projects on the first call.
	 */
	private async getPullRequestOrgProjects(prNumber: number): Promise<ProjectModel[]> {
		if (this.prProjects === null) {
			this.prProjects = await this.projClient.getPullRequestProjects(prNumber);
		}

		return this.prProjects;
	}

	/**
	 * Syncs a pull request with the given {@link prNumber} to an issue with the given {@link issueNumber} in a repository
	 * with a name that matches the given {@link repoName}.
	 * @param prNumber The pull request number.
	 * @param issueNumber The issue number.
	 */
	private async syncPullRequestToIssue(prNumber: number, issueNumber: number): Promise<void> {
		const issue = await this.getIssue(issueNumber);
		const issueLabels = issue.labels?.map((label) => label.name) ?? [];

		const pr = await this.getPullRequest(prNumber);
		const prTitle = pr.title;

		const prRequestData: IIssueOrPRRequestData = {
			title: prTitle,
			state: pr.state as IssueState,
			state_reason: null,
			assignees: issue.assignees?.map((i) => i.login) ?? [],
			labels: issueLabels,
			milestone: issue.milestone?.number ?? null,
		};

		await this.prClient.updatePullRequest(prNumber, prRequestData);
	}

	/**
	 * Updates the body pull request sync template of a pull request with the given {@link prNumber} in a repository
	 * with a name that matches the given {@link repoName}.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 */
	private async updatePRBody(issueNumber: number, prNumber: number): Promise<void> {
		const allowedPRBaseBranches = await this.getAllowedPRBaseBranches();
		const templateSettings = await this.buildTemplateSettings(issueNumber, prNumber);
		const updatedPRDescription = this.prTemplateManager.createPrSyncTemplate(
			allowedPRBaseBranches,
			issueNumber,
			templateSettings,
		);

		const prRequestData: IIssueOrPRRequestData = {
			body: updatedPRDescription,
		};

		await this.prClient.updatePullRequest(prNumber, prRequestData);
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
	 * @param prHeadBranch The head branch of the pull request.
	 * @param prBaseBranch The base branch of the pull request.
	 * @returns A list of problems related to the given {@link templateSettings}.
	 */
	private buildProblemsList(
		templateSettings: IPRTemplateSettings,
		issueTitle = "",
		prTitle = "",
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

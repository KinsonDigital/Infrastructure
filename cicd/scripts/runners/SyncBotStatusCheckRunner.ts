import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { IssueClient } from "../../clients/IssueClient.ts";
import { ProjectClient } from "../../clients/ProjectClient.ts";
import { PullRequestClient } from "../../clients/PullRequestClient.ts";
import { EventType } from "../../core/Enums.ts";
import { PullRequestModel } from "../../core/Models/PullRequestModel.ts";
import { IssueModel } from "../../core/Models/IssueModel.ts";
import { ProjectModel } from "../../core/Models/ProjectModel.ts";
import { IIssueOrPRRequestData } from "../../core/IIssueOrPRRequestData.ts";
import { IPRTemplateSettings } from "../../core/IPRTemplateSettings.ts";
import { PRTemplateManager } from "../../core/PRTemplateManager.ts";
import { GitHubLogType, IssueState } from "../../core/Enums.ts";
import { GitHubVariableService } from "../../core/Services/GitHubVariableService.ts";
import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";

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

		const [orgName, repoName, , , token] = args;

		this.prTemplateManager = new PRTemplateManager();
		this.issueClient = new IssueClient(token);
		this.projClient = new ProjectClient(token);
		this.prClient = new PullRequestClient(token);
		this.githubVarService = new GitHubVariableService(orgName, repoName, token);
	}

	/**
	 * Runs the sync status check script.
	 */
	public async run(): Promise<void> {
		await super.run();

		const [orgName, repoName, issueOrPrNumber, eventTypeStr] = this.args;

		Utils.printInGroup("Script Arguments", [
			`Organization Name (Required): ${orgName}`,
			`Repo Name (Required): ${repoName}`,
			`${eventTypeStr === "issue" ? "Issue" : "Pull Request"} Number (Required): ${issueOrPrNumber}`,
			`Event Type (Required): ${eventTypeStr}`,
			`GitHub Token (Required): "****"}`,
		]);

		const problemsFound: string[] = [];
		let issueNumber = 0;
		let prNumber = 0;

		const eventType = <EventType> eventTypeStr.toLowerCase();

		if (eventType === EventType.issue) {
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
					noticeMsg += `Issue: ${Utils.buildIssueUrl(orgName, repoName, issueNumber)}`;

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

		const prTemplate = (await this.getPullRequest(repoName, prNumber)).body;
		const syncingDisabled = this.prTemplateManager.syncingDisabled(prTemplate);

		// Syncing is disabled or the PR body does not contain a sync template
		if (syncingDisabled) {
			let syncDisabledMsg = `Syncing for pull request '${prNumber}' is disabled.`;
			syncDisabledMsg += "\nMake sure that the pull request description contains a valid PR sync template";
			syncDisabledMsg += "\n and make sure that syncing is enabled by checking the 'Sync with the issue' checkbox.";
			syncDisabledMsg += `\nPR: ${Utils.buildPullRequestUrl(orgName, repoName, prNumber)}`;

			Utils.printAsGitHubNotice(syncDisabledMsg);
			Deno.exit(0);
		}

		if (eventTypeStr === EventType.issue) {
			await this.runAsSyncBot(repoName, issueNumber, prNumber);
		} else {
			problemsFound.push(...await this.runAsStatusCheck(repoName, issueNumber, prNumber));
		}

		const prUrl = `\nIssue: ${Utils.buildIssueUrl(orgName, repoName, issueNumber)}`;
		const issueUrl = `\nPull Request: ${Utils.buildPullRequestUrl(orgName, repoName, prNumber)}`;

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
			const argDescriptions = [
				`The cicd script must have 5 arguments but has ${args.length} argument(s).`,
				"Required and must be a valid GitHub organization name.",
				"Required and must be a valid GitHub repository name.",
				"Required and must be a valid issue or pull request number.",
				"Required and must be a valid case-insensitive workflow event type of 'issue' or 'pr'.",
				"Required and must be a GitHub PAT (Personal Access Token).",
			];

			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.error);
			Deno.exit(1);
		}

		args = args.map((arg) => arg.trim());

		let [orgName, repoName, issueOrPRNumberStr, eventType] = args;

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

		orgName = orgName.trim();
		const orgClient = new OrgClient(this.token);

		// If the org does not exist
		if (!(await orgClient.exists(orgName))) {
			Utils.printAsGitHubError(`The organization '${orgName}' does not exist.`);
			Deno.exit(1);
		}

		repoName = repoName.trim();
		const repoClient = new RepoClient(this.token);

		// If the repo does not exist
		if (!(await repoClient.exists(repoName))) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [orgName, repoName, issueOrPrNumber, eventType, githubToken] = args;

		orgName = orgName.trim();
		repoName = repoName.trim();
		issueOrPrNumber = issueOrPrNumber.trim();
		eventType = eventType.trim().toLowerCase();
		githubToken = githubToken.trim();

		return [orgName, repoName, issueOrPrNumber, eventType, githubToken];
	}

	/**
	 * Runs the script as a sync bot.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 */
	private async runAsSyncBot(repoName: string, issueNumber: number, prNumber: number): Promise<void> {
		await this.syncPullRequestToIssue(repoName, prNumber, issueNumber);
		await this.updatePRBody(repoName, issueNumber, prNumber);
	}

	/**
	 * Runs the script as a status check.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @returns The list of problems found.
	 */
	private async runAsStatusCheck(
		repoName: string,
		issueNumber: number,
		prNumber: number,
	): Promise<string[]> {
		const problemsFound: string[] = [];
		const issueTitle = (await this.getIssue(repoName, issueNumber)).title;
		const prTitle = (await this.getPullRequest(repoName, prNumber)).title;
		const prHeadBranch = (await this.getPullRequest(repoName, prNumber)).head.ref;
		const prBaseBranch = (await this.getPullRequest(repoName, prNumber)).base.ref;

		const templateSettings = await this.buildTemplateSettings(repoName, issueNumber, prNumber);

		await this.updatePRBody(repoName, issueNumber, prNumber);

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
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 * @returns The template settings to use for processing the pull request sync template.
	 */
	private async buildTemplateSettings(
		repoName: string,
		issueNumber: number,
		prNumber: number,
	): Promise<IPRTemplateSettings> {
		const issueProjects: ProjectModel[] = await this.getIssueOrgProjects(repoName, issueNumber);
		const prProjects: ProjectModel[] = await this.getPullRequestOrgProjects(repoName, prNumber);

		const issueTitle = (await this.getIssue(repoName, issueNumber)).title;
		const issueAssignees = (await this.getIssue(repoName, issueNumber)).assignees;
		const issueLabels = (await this.getIssue(repoName, issueNumber)).labels;
		const issueMilestone = (await this.getIssue(repoName, issueNumber)).milestone;

		const pr = await this.prClient.getPullRequest(repoName, prNumber);
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
	 * @param repoName The name of the repository.
	 * @param issueNumber
	 * @returns
	 */
	private async getIssue(repoName: string, issueNumber: number): Promise<IssueModel> {
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
	private async getPullRequest(repoName: string, prNumber: number): Promise<PullRequestModel> {
		if (this.pr === null) {
			this.pr = await this.prClient.getPullRequest(repoName, prNumber);
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

		if (Utils.isNullOrEmptyOrUndefined(prSyncBranchesStr)) {
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
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @returns The projects associated with the issue.
	 * @remarks Caches the projects on the first call.
	 */
	private async getIssueOrgProjects(repoName: string, issueNumber: number): Promise<ProjectModel[]> {
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
	private async getPullRequestOrgProjects(repoName: string, prNumber: number): Promise<ProjectModel[]> {
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
	 * with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 */
	private async updatePRBody(repoName: string, issueNumber: number, prNumber: number): Promise<void> {
		const allowedPRBaseBranches = await this.getAllowedPRBaseBranches();
		const templateSettings = await this.buildTemplateSettings(repoName, issueNumber, prNumber);
		const updatedPRDescription = this.prTemplateManager.createPrSyncTemplate(
			allowedPRBaseBranches,
			issueNumber,
			templateSettings,
		);

		const prRequestData: IIssueOrPRRequestData = {
			body: updatedPRDescription,
		};

		await this.prClient.updatePullRequest(repoName, prNumber, prRequestData);
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

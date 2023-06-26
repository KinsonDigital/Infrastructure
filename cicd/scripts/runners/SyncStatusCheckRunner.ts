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

/**
 * Processes the sync bot status check script.  Used to run pull request static checks showing
 * if an issue is properly synced with an associated pull request.
 * 
 * TODO: Add more info about the bot side of the runner
 */
export class SyncStatusCheckRunner extends ScriptRunner {
	private issueClient: IssueClient;
	private projClient: ProjectClient;
	private prClient: PullRequestClient;
	private repoClient: RepoClient;
	private userClient: UsersClient;
	private issue: IIssueModel | null = null;
	private pr: IPullRequestModel | null = null;
	private readonly organization: string = "KinsonDigital";

	/**
	 * Initializes a new instance of the {@link SyncStatusCheckRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[], scriptName: string) {
		if (args.length != 5) {
			let argDescriptions: string[] = [];

			for (let i = 0; i < 5; i++) {
				argDescriptions.push(`${Utils.toOrdinal(i + 1)} Arg: $`);
			}

			argDescriptions[0] = argDescriptions[0].replace("$", "Required and must be a valid GitHub repository name.");
			argDescriptions[1] = argDescriptions[1].replace("$", "Required and must be a valid issue or pull request number.");
			argDescriptions[2] = argDescriptions[2].replace("$", "Required and must be a valid GitHub user requested to review the pull request.");
			argDescriptions[3] = argDescriptions[3].replace("$", "Required and must be a valid case-insensitive workflow event type of 'issue' or 'pr'.");
			argDescriptions[4] = argDescriptions[4].replace("$", "Required and must be a valid GitHub token.");

			argDescriptions.unshift(`The ${scriptName} cicd script must have 5 arguments.`);

			Utils.printAsGitHubError(argDescriptions.join("\n"));
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

		const [repoName, issueOrPrNumber, defaultReviewer, eventType, githubToken] = this.args;
	
		Utils.printInGroup("Script Arguments", [
			`Repo Name (Required): ${repoName}`,
			`${eventType === "issue" ? "Issue" : "Pull Request"} Number (Required): ${issueOrPrNumber}`,
			`Default Reviewer (Required): ${defaultReviewer}`,
			`Event Type (Required): ${eventType}`,
			`GitHub Token (Required): ${Utils.isNullOrEmptyOrUndefined(githubToken) ? "Not Provided" : "****"}`,
		]);

		if (!(await this.repoClient.repoExists(repoName))) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		if (!(await this.userClient.userExists(defaultReviewer))) {
			Utils.printAsGitHubError(`The GitHub user '${defaultReviewer}' does not exist.`);
			Deno.exit(1);
		}

		const problemsFound: string[] = [];
		let issueNumber: number = 0;
		let prNumber: number = 0;
		
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
					problemsFound.push(`The issue '${issueNumber}' does not contain a pull request metadata.`);
				} else {
					prNumber = Number.parseInt((<RegExpMatchArray> prLinkMetaData[0].match(/[0-9]+/gm))[0]);
				}
			}
		} else { // Run as a status check
			prNumber = Number.parseInt(issueOrPrNumber);

			if (!(await this.prClient.pullRequestExists(repoName, prNumber))) {
				problemsFound.push(`The pull request '${prNumber}' does not exist.`);
			} else {
				const featureBranchRegex = /^feature\/[1-9]+-(?!-)[a-z-]+$/gm;
				const headBranch = (await this.getPullRequest(repoName, prNumber)).head.ref;
				const headBranchNotValid = headBranch.match(featureBranchRegex) === null;
		
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

		// If syncing is disabled, do not run the bot or status check process
		if (prTemplateManager.syncingDisabled(prTemplate)) {
			let syncDisabledMsg = `Syncing for pull request '${prNumber}' is disabled.`;
			syncDisabledMsg += "\nTo enable syncing, check the 'Sync with the issue' checkbox.";
			syncDisabledMsg += `\nPR: ${Utils.buildPullRequestUrl(this.organization, repoName, prNumber)}`;

			Utils.printAsGitHubNotice(syncDisabledMsg);
			Deno.exit(0);
		}

		problemsFound.push(...await this.runScript(repoName, defaultReviewer, issueNumber, prNumber));

		const prUrl = `\nIssue: ${Utils.buildIssueUrl(this.organization, repoName, issueNumber)}`;
		const issueUrl = `\nPull Request: ${Utils.buildPullRequestUrl(this.organization, repoName, prNumber)}`;

		let successMsg = `✅No issues found. Issue '${issueNumber}' synced with pull request '${prNumber}'.`;
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
		args = args.map(arg => arg.trim());

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

	private async runScript(repoName: string, defaultReviewer: string, issueNumber: number, prNumber: number): Promise<string[]> {
		const problemsFound: string[] = [];
		const issueProjects: IProjectModel[] = await this.projClient.getIssueProjects(repoName, issueNumber);
		const prProjects: IProjectModel[] = await this.projClient.getPullRequestProjects(repoName, prNumber);
		
		const issueTitle = (await this.getIssue(repoName, issueNumber)).title;
		const issueAssignees = (await this.getIssue(repoName, issueNumber)).assignees;
		const issueLabels = (await this.getIssue(repoName, issueNumber)).labels;
		const issueMilestone = (await this.getIssue(repoName, issueNumber)).milestone;

		const prTitle = (await this.getPullRequest(repoName, prNumber)).title;
		const prBody = (await this.getPullRequest(repoName, prNumber)).body;
		const prAssignees = (await this.getPullRequest(repoName, prNumber)).assignees;
		const prLabels = (await this.getPullRequest(repoName, prNumber)).labels;
		const prMilestone = (await this.getPullRequest(repoName, prNumber)).milestone;
		const prHeadBranch = (await this.getPullRequest(repoName, prNumber)).head.ref;
		const prBaseBranch = (await this.getPullRequest(repoName, prNumber)).base.ref;
		const prRequestedReviewers = (await this.getPullRequest(repoName, prNumber)).requested_reviewers;

		const featureBranchRegex = /^feature\/[1-9]+-(?!-)[a-z-]+$/gm;
		const headBranchIsValid = prHeadBranch.match(featureBranchRegex) != null;
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

		const prTemplateManager = new PRTemplateManager();
		
		const updatedPRDescription = prTemplateManager.processSyncTemplate(prBody, templateSettings);
		
		const prRequestData: IIssueOrPRRequestData = {
			body: updatedPRDescription,
		};
		
		await this.prClient.updatePullRequest(repoName, prNumber, prRequestData);
		
		problemsFound.push(...this.buildProblemsList(templateSettings, issueTitle ?? "", prTitle ?? "", prHeadBranch, prBaseBranch));

		console.log(`✅The issue '${issueNumber}' and pull request '${prNumber}' sync status has been updated✅.`);

		return problemsFound;
	}

	/**
	 * 
	 * @param repoName The name of the repository.
	 * @param issueNumber 
	 * @returns 
	 */
	private async getIssue(repoName: string, issueNumber: number): Promise<IIssueModel> {
		if (this.issue === null)
		{
			this.issue = await this.issueClient.getIssue(repoName, issueNumber);
		}

		return this.issue;
	}

	private async getPullRequest(repoName: string, prNumber: number): Promise<IPullRequestModel> {
		if (this.pr === null)
		{
			this.pr = await this.prClient.getPullRequest(repoName, prNumber);
		}

		return this.pr;
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

	private buildProblemsList(
		templateSettings: IPRTemplateSettings,
		issueTitle = "",
		prTitle = "",
		prHeadBranch = "",
		prBaseBranch = ""): string[] {
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
			problems.push(`The pr default reviewer '${templateSettings.defaultReviewerValid}' is not valid or set.`);
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

		return problems;;
	}
}

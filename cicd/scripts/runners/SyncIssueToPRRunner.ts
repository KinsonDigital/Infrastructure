import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { IssueClient } from "../../clients/IssueClient.ts";
import { PullRequestClient } from "../../clients/PullRequestClient.ts";
import { UsersClient } from "../../clients/UsersClient.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { PullRequestModel } from "../../core/Models/PullRequestModel.ts";
import { PRTemplateManager } from "../../core/PRTemplateManager.ts";
import { GitHubVariableService } from "../../core/Services/GitHubVariableService.ts";
import { IssueModel } from "../../core/Models/IssueModel.ts";
import { IIssueOrPRRequestData } from "../../core/IIssueOrPRRequestData.ts";
import { IssueOrPullRequest, IssueState } from "../../core/Enums.ts";
import { ProjectClient } from "../../clients/ProjectClient.ts";
import { ProjectModel } from "../../core/Models/ProjectModel.ts";
import { IPRTemplateSettings } from "../../core/IPRTemplateSettings.ts";

// TODO: Rename from 'SyncIssueToPRRunner' to 'SyncPRToIssueRunner'

/**
 * Syncs a pull request to an issue.
 */
export class SyncIssueToPRRunner extends ScriptRunner {
	private static readonly DEFAULT_PR_REVIEWER = "DEFAULT_PR_REVIEWER";
	private static readonly PR_SYNC_BASE_BRANCHES = "PR_SYNC_BASE_BRANCHES";
	private static readonly prMetaDataRegex = /<!--closed-by-pr:[0-9]+-->/gm;

	/**
	 * Initializes a new instance of the {@link SyncIssueToPRRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		super(args);
	}

	/**
	 * Runs the sync issue to pr script.
	 */
	public async run(): Promise<void> {
		await super.run();

		const [orgName, repoName, , prNumberStr] = this.args;

		const issueClient = new IssueClient(this.token);
		const prClient = new PullRequestClient(this.token);

		const issueOrPrNumber = parseInt(prNumberStr);

		const [issueNumber, prNumber] = await this.getIssueAndPrNumbers(repoName, issueOrPrNumber);

		const issue: IssueModel = await issueClient.getIssue(repoName, issueNumber);
		const pr: PullRequestModel = await prClient.getPullRequest(repoName, prNumber);
		const projectClient: ProjectClient = new ProjectClient(this.token);
		const githubRepoService = new GitHubVariableService(orgName, repoName, this.token);

		const issueProjects: ProjectModel[] = await projectClient.getIssueProjects(repoName, issueNumber);

		// Add all of the issue org projects to the PR
		for (let i = 0; i < issueProjects.length; i++) {
			const proj = issueProjects[i];

			if (pr.node_id === undefined) {
				continue;
			}

			await projectClient.addToProject(pr.node_id, proj.title);
			Utils.printAsGitHubNotice(`Pull request '${prNumber}' has been added to project '${proj.title}'.`);
		}

		await this.addIssueMetaData(repoName, issue, prNumber);
		const defaultReviewer = await githubRepoService.getValue(SyncIssueToPRRunner.DEFAULT_PR_REVIEWER, false);
		await prClient.requestReviewer(repoName, prNumber, defaultReviewer);

		let reviewerMsg = `The reviewer '${defaultReviewer}' has been requested as a reviewer `;
		reviewerMsg += `for the pull request ${prNumber}.`;
		Utils.printAsGitHubNotice(reviewerMsg);

		const issueLabels = issue.labels?.map((label) => label.name) ?? [];
		const prData: IIssueOrPRRequestData = {
			title: issue.title,
			state: pr.state as IssueState,
			state_reason: null,
			milestone: issue.milestone?.number ?? null,
			labels: issueLabels,
			assignees: issue.assignees?.map((i) => i.login) ?? [],
		};

		// Sync the pr to the issue
		await prClient.updatePullRequest(repoName, prNumber, prData);

		// Update the pr body to reflect the sync status between the issue and the pr
		await this.updateIssueBody(orgName, repoName, issueNumber, prNumber);
	}

	/**
	 * @inheritdoc
	 */
	protected async validateArgs(args: string[]): Promise<void> {
		if (args.length != 5) {
			let errorMsg = `The cicd script must have at 5 arguments but has ${args.length} arguments(s).`;
			errorMsg += "\nThe 1st arg is required and must be a valid organization name.";
			errorMsg += "\nThe 2nd arg is required and must be the GitHub repo name.";
			errorMsg += "\nThe 3rd arg is required and must be a valid GitHub user that triggered the script to run.";
			errorMsg += "\nThe 4th arg is required and must be a valid pull request number.";
			errorMsg += "\nThe 5th arg is required and must be a valid GitHub PAT (Personal Access Token).";

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		this.printOrgRepoVarsUsed();

		const [orgName, repoName, requestByUser, issueOrPRNumberStr] = args;

		const orgClient = new OrgClient(this.token);
		const repoClient = new RepoClient(this.token);
		const prClient = new PullRequestClient(this.token);
		const usersClient = new UsersClient(this.token);

		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);

		if (!Utils.isNumeric(issueOrPRNumberStr)) {
			Utils.printAsGitHubError(`The given issue or pull request number '${issueOrPRNumberStr}' is not a valid number.`);
			Deno.exit(1);
		}

		const issueOrPrNumber = parseInt(issueOrPRNumberStr);

		const [, prNumber] = await this.getIssueAndPrNumbers(repoName, issueOrPrNumber);

		const orgRepoVariables = this.getRequiredVars();

		// Check if all of the required org and/or repo variables exist
		const [orgRepoVarExist, missingVars] = await githubVarService.allVarsExist(orgRepoVariables);

		if (!orgRepoVarExist) {
			const missingVarErrors: string[] = [];

			for (let i = 0; i < missingVars.length; i++) {
				const missingVarName = missingVars[i];

				missingVarErrors.push(`The required org/repo variable '${missingVarName}' is missing.`);
			}

			Utils.printAsGitHubErrors(missingVarErrors);
			Deno.exit(1);
		}

		const requestedByUserDoesNotExist = !(await usersClient.userExists(requestByUser));
		if (requestedByUserDoesNotExist) {
			Utils.printAsGitHubError(`The requested by user '${requestByUser}' does not exist.`);
			Deno.exit(1);
		}

		const userIsNotOrgMember = !(await orgClient.userIsOrgAdminMember(orgName, requestByUser));
		if (userIsNotOrgMember) {
			let errorMsg = `The user '${requestByUser}' is not member of the`;
			errorMsg += ` organization '${orgName}' with the admin role.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(0);
		}

		const repoDoesNotExist = !(await repoClient.exists(repoName));
		if (repoDoesNotExist) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		const prDoesNotExist = !(await prClient.pullRequestExists(repoName, prNumber));
		if (prDoesNotExist) {
			Utils.printAsGitHubError(`A pull request with the number '${prNumber}' does not exist.`);
			Deno.exit(1);
		}

		const pr: PullRequestModel = await prClient.getPullRequest(repoName, prNumber);

		const prTemplateManager = new PRTemplateManager();

		// Check if syncing is disabled but only if a [run-sync] command
		if (prTemplateManager.syncingDisabled(pr.body)) {
			Utils.printAsGitHubWarning("Syncing is disabled.  Syncing will not occur.");
			Deno.exit(0);
		}

		const headBranch = pr.head.ref;

		// If the branch is not a feature branch, exit
		// We do not want to sync a pull request for a branch that is not a feature branch
		if (Utils.isNotFeatureBranch(headBranch)) {
			Utils.printAsGitHubError(`The head branch '${headBranch}' is not a feature branch.`);
			Deno.exit(1);
		}

		const defaultReviewer = await githubVarService.getValue(SyncIssueToPRRunner.DEFAULT_PR_REVIEWER, false);

		// If the default reviewer is not a valid GitHub user
		if (!(await usersClient.userExists(defaultReviewer))) {
			let errorMsg = `The default reviewer '${defaultReviewer}' does not exist.`;
			errorMsg +=
				`\nVerify that the value of the '${SyncIssueToPRRunner.DEFAULT_PR_REVIEWER}' or/repo variable is correct.`;

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		return Utils.trimAll(args);
	}

	private async getIssueAndPrNumbers(repoName: string, issueOrPrNumber: number): Promise<[number, number]> {
		let issueNumber = 0;
		let prNumber = 0;
		let pr: PullRequestModel;
		let issue: IssueModel;

		const issueOrPr = await this.isIssueOrPullRequestNumber(repoName, issueOrPrNumber);

		const issueClient = new IssueClient(this.token);
		const prClient = new PullRequestClient(this.token);

		if (
			issueOrPr != IssueOrPullRequest.issue &&
			issueOrPr != IssueOrPullRequest.pullRequest &&
			issueOrPr != IssueOrPullRequest.neither
		) {
			let errorMsg = `The given issue or pull request number '${issueOrPrNumber}' `;
			errorMsg += "is not a valid issue or pull request number.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		switch (issueOrPr) {
			case IssueOrPullRequest.issue:
				issueNumber = issueOrPrNumber;
				issue = await issueClient.getIssue(repoName, issueNumber);
				prNumber = this.getPRNumberFromIssueBody(issue.body);

				if (prNumber === 0) {
					let warningMsg = `The issue '${issueNumber}' does not contain any valid pull request number meta-data.`;
					warningMsg += " A pull request was not synced to an issue.";
					Utils.printAsGitHubWarning(warningMsg);
					Deno.exit(0);
				}

				break;
			case IssueOrPullRequest.pullRequest:
				prNumber = issueOrPrNumber;
				pr = await prClient.getPullRequest(repoName, prNumber);
				issueNumber = this.getIssueFromFeatureBranch(pr.head.ref);

				if (!(await issueClient.issueExists(repoName, issueNumber))) {
					let warningMsg = `The issue '${issueNumber}' does not exist.`;
					warningMsg += "A pull request was not synced to an issue.";
					Utils.printAsGitHubWarning(warningMsg);
					Deno.exit(0);
				}

				break;
			case IssueOrPullRequest.neither: {
				let warningMsg = `The number '${issueOrPrNumber}' is not an issue or pull request number.`;
				warningMsg += "A pull request was not synced to an issue.";
				Utils.printAsGitHubWarning(warningMsg);
				Deno.exit(0);
			}
		}

		return [issueNumber, prNumber];
	}

	private async isIssueOrPullRequestNumber(repoName: string, issueOrPullRequestNumber: number): Promise<IssueOrPullRequest> {
		const issueClient = new IssueClient(this.token);
		const prClient = new PullRequestClient(this.token);

		if (await prClient.pullRequestExists(repoName, issueOrPullRequestNumber)) {
			return IssueOrPullRequest.pullRequest;
		}

		if (await issueClient.issueExists(repoName, issueOrPullRequestNumber)) {
			return IssueOrPullRequest.issue;
		}

		return IssueOrPullRequest.neither;
	}

	private async addIssueMetaData(repoName: string, issue: IssueModel, prNumber: number): Promise<void> {
		const prMetaDataExists = SyncIssueToPRRunner.prMetaDataRegex.test(issue.body);
		const prMetaData = `<!--closed-by-pr:${prNumber}-->`;
		const issueBody = prMetaDataExists
			? issue.body.replace(SyncIssueToPRRunner.prMetaDataRegex, prMetaData)
			: issue.body + `\n\n${prMetaData}`;

		const subText = prMetaDataExists ? "updated in" : "added to";
		Utils.printAsGitHubNotice(`PR link metadata ${subText} the description of issue '${issue.number}'.`);

		// Update the description of the issue to include metadata about the pr number
		const issueData: IIssueOrPRRequestData = {
			body: issueBody,
		};

		const issueClient = new IssueClient(this.token);
		await issueClient.updateIssue(repoName, issue.number, issueData);
	}

	private getPRNumberFromIssueBody(issueBody: string): number {
		if (Utils.isNullOrEmptyOrUndefined(issueBody)) {
			return 0;
		}

		if (!SyncIssueToPRRunner.prMetaDataRegex.test(issueBody)) {
			return 0;
		}

		const prMetaData = issueBody.match(SyncIssueToPRRunner.prMetaDataRegex)?.map((match) => match)[0] ?? "";

		const prNumberStr = prMetaData.replace("<!--closed-by-pr:", "").replace("-->", "");

		return parseInt(prNumberStr);
	}

	// TODO: Cache the issue, but not the pr

	private async updateIssueBody(orgName: string, repoName: string, issueNumber: number, prNumber: number): Promise<void> {
		const issueClient = new IssueClient(this.token);
		const prClient = new PullRequestClient(this.token);

		const issue: IssueModel = await issueClient.getIssue(repoName, issueNumber);
		const pr: PullRequestModel = await prClient.getPullRequest(repoName, prNumber);

		const prTemplateManager = new PRTemplateManager();

		const projectClient: ProjectClient = new ProjectClient(this.token);
		const prProjects: ProjectModel[] = await projectClient.getPullRequestProjects(repoName, prNumber);
		const issueProjects: ProjectModel[] = await projectClient.getIssueProjects(repoName, issueNumber);

		const allowedPRBaseBranches = await this.getAllowedPRBaseBranches(orgName, repoName);
		const prBaseBranchValid = allowedPRBaseBranches.some((branch) => branch === pr.base.ref);

		const syncSettings: IPRTemplateSettings = {
			issueNumber: issueNumber,
			headBranchValid: Utils.isFeatureBranch(pr.head.ref),
			baseBranchValid: prBaseBranchValid,
			issueNumValid: true,
			titleInSync: pr?.title === issue?.title,
			assigneesInSync: Utils.assigneesMatch(issue.assignees, pr.assignees),
			labelsInSync: Utils.labelsMatch(issue.labels, pr.labels),
			projectsInSync: Utils.orgProjectsMatch(issueProjects, prProjects),
			milestoneInSync: pr.milestone?.number === issue.milestone?.number,
		};

		const prDescription = prTemplateManager.createPrSyncTemplate(allowedPRBaseBranches, issueNumber, syncSettings);
		const prData: IIssueOrPRRequestData = {
			body: prDescription,
		};

		await prClient.updatePullRequest(repoName, prNumber, prData);
	}

	/**
	 * Parses out the issue number from the given feature branch.
	 * @param featureBranch The feature branch.
	 * @returns The issue number parsed from the feature branch.
	 */
	private getIssueFromFeatureBranch(featureBranch: string): number {
		if (!Utils.isFeatureBranch(featureBranch)) {
			Utils.printAsGitHubError(`The given branch '${featureBranch}' is not a feature branch.`);
			Deno.exit(1);
		}

		return parseInt(Utils.splitBy(featureBranch.replace("feature/", ""), "-")[0]);
	}

	/**
	 * Gets the list of allowed base branches for a repository with a name that matches the given {@link repoName}.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repository.
	 * @param repoName The name of the repository.
	 * @returns The list of allowed base branches.
	 */
	private async getAllowedPRBaseBranches(orgName: string, repoName: string): Promise<string[]> {
		const defaultBranches = ["main", "preview"];

		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);
		const prSyncBranchesStr = await githubVarService.getValue(SyncIssueToPRRunner.PR_SYNC_BASE_BRANCHES, false);

		if (Utils.isNullOrEmptyOrUndefined(prSyncBranchesStr)) {
			let noticeMsg =
				`The optional variable '${SyncIssueToPRRunner.PR_SYNC_BASE_BRANCHES}' does not exist or contains no value.`;
			noticeMsg += `\nUsing the default branches: ${defaultBranches.join(", ")}.`;
			Utils.printAsGitHubNotice(noticeMsg);

			return defaultBranches;
		}

		const prSyncBaseBranches = Utils.splitByComma(prSyncBranchesStr);

		return prSyncBaseBranches.length > 0 ? prSyncBaseBranches : defaultBranches;
	}

	/**
	 * Prints the required org or repo variables for the runner.
	 */
	private printOrgRepoVarsUsed(): void {
		Utils.printInGroup("Required Org Or Repo Variables", this.getRequiredVars());
	}

	/* Gets the list of required vars.
	 * @returns The list of required vars.
	*/
	private getRequiredVars(): string[] {
		return [SyncIssueToPRRunner.DEFAULT_PR_REVIEWER];
	}
}

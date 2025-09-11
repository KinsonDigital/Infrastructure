import { IssueClient, OrgClient, ProjectClient, PullRequestClient, RepoClient, UsersClient } from "@kd-clients/github";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { IssueModel, ProjectModel, PullRequestModel } from "@kd-clients/github-models";
import { PRTemplateManager } from "../../core/PRTemplateManager.ts";
import { GitHubVariableService } from "../../core/Services/GitHubVariableService.ts";
import { IIssueOrPRRequestData } from "../../core/IIssueOrPRRequestData.ts";
import { IssueOrPullRequest, IssueState } from "../../core/Enums.ts";
import { IPRTemplateSettings } from "../../core/IPRTemplateSettings.ts";

/**
 * Syncs a pull request to an issue.
 */
export class SyncPRToIssueRunner extends ScriptRunner {
	private static readonly DEFAULT_PR_REVIEWER = "DEFAULT_PR_REVIEWER";
	private static readonly PR_SYNC_BASE_BRANCHES = "PR_SYNC_BASE_BRANCHES";
	private static readonly prMetaDataRegex = /<!--\s*closed-by-pr:\s*[1-9][0-9]*\s*-->/gm;
	private readonly githubVarService: GitHubVariableService;

	/**
	 * Initializes a new instance of the {@link SyncPRToIssueRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		super(args);

		const [ownerName, repoName] = this.args;
		this.githubVarService = new GitHubVariableService(ownerName, repoName, this.token);
	}

	/**
	 * Runs the sync issue to pr script.
	 */
	public override async run(): Promise<void> {
		await super.run();

		const [ownerName, repoName, , prNumberStr] = this.args;

		this.githubVarService.setOrgAndRepo(ownerName, repoName);

		const issueClient = new IssueClient(ownerName, repoName, this.token);
		const prClient = new PullRequestClient(ownerName, repoName, this.token);

		const issueOrPrNumber = parseInt(prNumberStr);

		const [issueNumber, prNumber] = await this.getIssueAndPrNumbers(ownerName, repoName, issueOrPrNumber);

		const issue: IssueModel = await issueClient.getIssue(issueNumber);
		const pr: PullRequestModel = await prClient.getPullRequest(prNumber);
		const projectClient: ProjectClient = new ProjectClient(ownerName, repoName, this.token);

		const issueProjects: ProjectModel[] = await projectClient.getIssueProjects(issueNumber);

		// Add all of the issue org projects to the PR
		for (let i = 0; i < issueProjects.length; i++) {
			const proj = issueProjects[i];

			if (pr.node_id === undefined) {
				continue;
			}

			await projectClient.addPullRequestToProject(pr.number, proj.title);
			Utils.printAsGitHubNotice(`Pull request '${prNumber}' has been added to project '${proj.title}'.`);
		}

		await this.addPullRequestMetaData(ownerName, repoName, issue, prNumber);
		const defaultReviewer = await this.githubVarService.getValue(SyncPRToIssueRunner.DEFAULT_PR_REVIEWER, false);
		await prClient.requestReviewers(prNumber, defaultReviewer);

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
		await prClient.updatePullRequest(prNumber, prData);

		// Update the pr body to reflect the sync status between the issue and the pr
		await this.updatePullRequestBody(ownerName, repoName, issueNumber, prNumber);
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
			errorMsg += "\nThe 4th arg is required and must be a valid issue or pull request number.";
			errorMsg += "\nThe 5th arg is required and must be a valid GitHub PAT (Personal Access Token).";

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		this.printOrgRepoVarsUsed();

		const [ownerName, repoName, requestByUser, issueOrPRNumberStr] = args;

		this.githubVarService.setOrgAndRepo(ownerName, repoName);

		const orgClient = new OrgClient(ownerName, this.token);
		const repoClient = new RepoClient(ownerName, repoName, this.token);
		const prClient = new PullRequestClient(ownerName, repoName, this.token);
		const usersClient = new UsersClient(ownerName, repoName, this.token);

		if (!Utils.isNumeric(issueOrPRNumberStr)) {
			Utils.printAsGitHubError(`The given issue or pull request number '${issueOrPRNumberStr}' is not a valid number.`);
			Deno.exit(1);
		}

		const issueOrPrNumber = parseInt(issueOrPRNumberStr);

		const [, prNumber] = await this.getIssueAndPrNumbers(ownerName, repoName, issueOrPrNumber);

		const orgRepoVariables = this.getRequiredVars();

		// Check if all of the required org and/or repo variables exist
		const [orgRepoVarExist, missingVars] = await this.githubVarService.allVarsExist(orgRepoVariables);

		if (!orgRepoVarExist) {
			const missingVarErrors: string[] = [];

			for (let i = 0; i < missingVars.length; i++) {
				const missingVarName = missingVars[i];

				missingVarErrors.push(`The required org/repo variable '${missingVarName}' is missing.`);
			}

			Utils.printAsGitHubErrors(missingVarErrors);
			Deno.exit(1);
		}

		const validateAsOrgMember = requestByUser.toLowerCase().startsWith("validate:");

		// If the sync is manual, validate that the user is an org member
		if (validateAsOrgMember) {
			const githubLogin = requestByUser.replace("validate:", "");

			const userIsNotOrgMember = !(await orgClient.userIsOrgAdminMember(githubLogin));
			if (userIsNotOrgMember) {
				let errorMsg = `The user '${requestByUser}' is not member of the`;
				errorMsg += ` organization '${ownerName}' with the admin role.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		} else {
			const requestedByUserDoesNotExist = !(await usersClient.userExists(requestByUser));
			if (requestedByUserDoesNotExist) {
				Utils.printAsGitHubError(`The requested by user '${requestByUser}' does not exist.`);
				Deno.exit(1);
			}
		}

		const repoDoesNotExist = !(await repoClient.exists());
		if (repoDoesNotExist) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		const prDoesNotExist = !(await prClient.exists(prNumber));
		if (prDoesNotExist) {
			Utils.printAsGitHubError(`A pull request with the number '${prNumber}' does not exist.`);
			Deno.exit(1);
		}

		const pr: PullRequestModel = await prClient.getPullRequest(prNumber);

		const headBranch = pr.head.ref;

		// If the branch is not a feature branch, exit
		// We do not want to sync a pull request for a branch that is not a feature branch
		if (Utils.isNotFeatureBranch(headBranch)) {
			Utils.printAsGitHubError(`The head branch '${headBranch}' is not a feature branch.`);
			Deno.exit(1);
		}

		const defaultReviewer = await this.githubVarService.getValue(SyncPRToIssueRunner.DEFAULT_PR_REVIEWER, false);

		// If the default reviewer is not a valid GitHub user
		if (!(await usersClient.userExists(defaultReviewer))) {
			let errorMsg = `The default reviewer '${defaultReviewer}' does not exist.`;
			errorMsg +=
				`\nVerify that the value of the '${SyncPRToIssueRunner.DEFAULT_PR_REVIEWER}' or/repo variable is correct.`;

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

	/**
	 * Gets the issue and pull request numbers that are linked to each other.
	 * @param ownerName The owner name of the repository.
	 * @param repoName The name of the repository.
	 * @param issueOrPrNumber The issue or pull request number.
	 * @returns Both the issue and pull request numbers.
	 */
	private async getIssueAndPrNumbers(ownerName: string, repoName: string, issueOrPrNumber: number): Promise<[number, number]> {
		let issueNumber = 0;
		let prNumber = 0;
		let pr: PullRequestModel;
		let issue: IssueModel;

		const issueOrPr = await this.isIssueOrPullRequestNumber(ownerName, repoName, issueOrPrNumber);

		const issueClient = new IssueClient(ownerName, repoName, this.token);
		const prClient = new PullRequestClient(ownerName, repoName, this.token);

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
				issue = await issueClient.getIssue(issueNumber);
				prNumber = this.getPRNumberFromIssueBody(issue.body);

				if (prNumber === 0) {
					let warningMsg = `The issue '${issueNumber}' does not contain any valid pull request number meta-data.`;
					warningMsg += " The pull request was not synced to an issue.";
					Utils.printAsGitHubWarning(warningMsg);
					Deno.exit(0);
				}

				break;
			case IssueOrPullRequest.pullRequest:
				prNumber = issueOrPrNumber;
				pr = await prClient.getPullRequest(prNumber);
				issueNumber = this.getIssueFromFeatureBranch(pr.head.ref);

				if (!(await issueClient.exists(issueNumber))) {
					let warningMsg = `The issue '${issueNumber}' does not exist.`;
					warningMsg += " The pull request was not synced to an issue.";
					Utils.printAsGitHubWarning(warningMsg);
					Deno.exit(0);
				}

				break;
			case IssueOrPullRequest.neither: {
				let warningMsg = `The number '${issueOrPrNumber}' is not an issue or pull request number.`;
				warningMsg += " The pull request was not synced to an issue.";
				Utils.printAsGitHubWarning(warningMsg);
				Deno.exit(0);
			}
		}

		return [issueNumber, prNumber];
	}

	/**
	 * Returns a value indicating if the given {@link issueOrPullRequestNumber} is an issue, pull request, or neither.
	 * @param ownerName The owner name of the repository.
	 * @param repoName The name of the repository.
	 * @param issueOrPullRequestNumber The issue or pull request number.
	 * @returns Enum representing if the given {@link issueOrPullRequestNumber} is an issue, pull request, or neither.
	 */
	private async isIssueOrPullRequestNumber(
		ownerName: string,
		repoName: string,
		issueOrPullRequestNumber: number,
	): Promise<IssueOrPullRequest> {
		const issueClient = new IssueClient(ownerName, repoName, this.token);
		const prClient = new PullRequestClient(ownerName, repoName, this.token);

		if (await prClient.exists(issueOrPullRequestNumber)) {
			return IssueOrPullRequest.pullRequest;
		}

		if (await issueClient.exists(issueOrPullRequestNumber)) {
			return IssueOrPullRequest.issue;
		}

		return IssueOrPullRequest.neither;
	}

	/**
	 * Adds pull request meta-data to the given {@link issue}, with the given {@link prNumber},
	 * for a repository with a name that matches the given {@link repoName}.
	 * @param repoName The owner name of the repository.
	 * @param repoName The name of the repository.
	 * @param issue The issue to add the meta-data to.
	 * @param prNumber The pull request number to add to the meta-data.
	 */
	private async addPullRequestMetaData(
		ownerName: string,
		repoName: string,
		issue: IssueModel,
		prNumber: number,
	): Promise<void> {
		const prMetaDataExists = SyncPRToIssueRunner.prMetaDataRegex.test(issue.body);
		const prMetaData = `<!--closed-by-pr:${prNumber}-->`;
		const issueBody = prMetaDataExists
			? issue.body.replace(SyncPRToIssueRunner.prMetaDataRegex, prMetaData)
			: issue.body + `\n\n${prMetaData}`;

		const subText = prMetaDataExists ? "updated in" : "added to";
		Utils.printAsGitHubNotice(`PR link metadata ${subText} the description of issue '${issue.number}'.`);

		// Update the description of the issue to include metadata about the pr number
		const issueData: IIssueOrPRRequestData = {
			body: issueBody,
		};

		const issueClient = new IssueClient(ownerName, repoName, this.token);
		await issueClient.updateIssue(issue.number, issueData);
	}

	/**
	 * Gets the pull request number embedded in meta-data that is in the given {@link issueBody}.
	 * @param issueBody The body of an issue.
	 * @returns The pull request number.
	 */
	private getPRNumberFromIssueBody(issueBody: string): number {
		if (Utils.isNothing(issueBody)) {
			return 0;
		}

		if (!SyncPRToIssueRunner.prMetaDataRegex.test(issueBody)) {
			return 0;
		}

		const prMetaData = issueBody.match(SyncPRToIssueRunner.prMetaDataRegex)?.map((match) => match)[0] ?? "";

		const prNumberStr = prMetaData.replace("<!--closed-by-pr:", "").replace("-->", "");

		return parseInt(prNumberStr);
	}

	/**
	 * Updates the body of a pull request that belongs to a repository with a name that matches the given {@link repoName},
	 * where the pull request has a number that matches the given {@link prNumber}, with an issue linked
	 * to the pull request that matches the given {@link issueNumber},
	 * @param repoName The owner name of the repository.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @param prNumber The pull request number.
	 */
	private async updatePullRequestBody(
		ownerName: string,
		repoName: string,
		issueNumber: number,
		prNumber: number,
	): Promise<void> {
		const issueClient = new IssueClient(ownerName, repoName, this.token);
		const prClient = new PullRequestClient(ownerName, repoName, this.token);

		const issue: IssueModel = await issueClient.getIssue(issueNumber);
		const pr: PullRequestModel = await prClient.getPullRequest(prNumber);

		const prTemplateManager = new PRTemplateManager();

		const projectClient: ProjectClient = new ProjectClient(ownerName, repoName, this.token);
		const prProjects: ProjectModel[] = await projectClient.getPullRequestProjects(prNumber);
		const issueProjects: ProjectModel[] = await projectClient.getIssueProjects(issueNumber);

		const allowedPRBaseBranches = await this.getAllowedPRBaseBranches();
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

		await prClient.updatePullRequest(prNumber, prData);
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
	 * Gets the list of allowed base branches.
	 * @returns The list of allowed base branches.
	 */
	private async getAllowedPRBaseBranches(): Promise<string[]> {
		const defaultBranches = ["main", "preview"];

		const prSyncBranchesStr = await this.githubVarService.getValue(SyncPRToIssueRunner.PR_SYNC_BASE_BRANCHES, false);

		if (Utils.isNothing(prSyncBranchesStr)) {
			let noticeMsg =
				`The optional variable '${SyncPRToIssueRunner.PR_SYNC_BASE_BRANCHES}' does not exist or contains no value.`;
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
		return [SyncPRToIssueRunner.DEFAULT_PR_REVIEWER];
	}
}

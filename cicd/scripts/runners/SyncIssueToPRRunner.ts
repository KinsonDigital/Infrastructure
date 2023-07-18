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
import { IssueState } from "../../core/Enums.ts";
import { ProjectClient } from "../../clients/ProjectClient.ts";
import { ProjectModel } from "../../core/Models/ProjectModel.ts";
import { IPRTemplateSettings } from "../../core/IPRTemplateSettings.ts";

export class SyncIssueToPRRunner extends ScriptRunner {
	private static readonly DEFAULT_PR_REVIEWER = "DEFAULT_PR_REVIEWER";
	private static readonly RELATIVE_PR_SYNC_TEMPLATE_FILE_PATH = "RELATIVE_PR_SYNC_TEMPLATE_FILE_PATH";
	private static readonly PR_SYNC_TEMPLATE_REPO_NAME = "PR_SYNC_TEMPLATE_REPO_NAME";
	private static readonly PR_SYNC_TEMPLATE_BRANCH_NAME = "PR_SYNC_TEMPLATE_BRANCH_NAME";
	private readonly runSyncCommandRegex = /\[run-sync\]/gm;
	private readonly initialSyncCommandRegex = /\[initial-sync\]/gm;
	private readonly prMetaDataRegex = /<!--closed-by-pr:[0-9]+-->/gm;

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
		const [orgName, repoName, , prNumberStr, syncCommand] = this.args;

		// TODO: Cache the issue and pull request originally in the validate func

		const prNumber = parseInt(prNumberStr);
		const prClient = new PullRequestClient(this.token);

		let pr = await prClient.getPullRequest(repoName, prNumber);
		const issueNumber = this.getIssueFromFeatureBranch(pr.head.ref);

		const issueClient = new IssueClient(this.token);
		const issue: IssueModel = await issueClient.getIssue(repoName, issueNumber);

		const prTemplateManager = new PRTemplateManager(orgName, repoName, this.token);

		const issueLabels = issue.labels?.map((label) => label.name) ?? [];

		const isInitialSyncCommand = this.initialSyncCommandRegex.test(syncCommand);
		
		const githubRepoService = new GitHubVariableService(orgName, repoName, this.token);

		const prSyncTemplateRepoName = await githubRepoService.getValue(SyncIssueToPRRunner.PR_SYNC_TEMPLATE_REPO_NAME, false);
		const prSyncTemplateBranchName = await githubRepoService.getValue(SyncIssueToPRRunner.PR_SYNC_TEMPLATE_BRANCH_NAME, false);
		const relativeTemplateFilePath = await githubRepoService.getValue(SyncIssueToPRRunner.RELATIVE_PR_SYNC_TEMPLATE_FILE_PATH, false);
		
		// If the pr body is not a valid pr template, load a new one to replace it.
		const prDescription = isInitialSyncCommand || !prTemplateManager.isPRSyncTemplate(pr.body)
			? await prTemplateManager.getPullRequestTemplate(prSyncTemplateRepoName, prSyncTemplateBranchName, relativeTemplateFilePath, issueNumber)
			: pr.body;

		// If the title does not match, sync the title
		const prData: IIssueOrPRRequestData = {
			title: issue.title,
			body: prDescription,
			state: pr.state as IssueState,
			state_reason: null,
			milestone: issue.milestone?.number ?? null,
			labels: issueLabels,
			assignees: issue.assignees?.map((i) => i.login) ?? [],
		};

		await prClient.updatePullRequest(repoName, prNumber, prData);
		pr = await prClient.getPullRequest(repoName, prNumber);

		const defaultReviewer = await githubRepoService.getValue(SyncIssueToPRRunner.DEFAULT_PR_REVIEWER, false);
		await prClient.requestReviewer(repoName, prNumber, defaultReviewer);

		let reviewerMsg = `The reviewer '${defaultReviewer}' has been requested as a reviewer `;
		reviewerMsg += `for the pull request ${prNumber}.`;
		Utils.printAsGitHubNotice(reviewerMsg);

		const projectClient: ProjectClient = new ProjectClient(this.token);
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

		const prMetaDataExists = this.prMetaDataRegex.test(issue.body);
		const prMetaData = `<!--closed-by-pr:${prNumber}-->`;
		const issueBody = prMetaDataExists
			? issue.body.replace(this.prMetaDataRegex, prMetaData)
			: issue.body + `\n\n${prMetaData}`;

		// Update the description of the issue to include metadata about the pr number
		const issueData: IIssueOrPRRequestData = {
			body: issueBody,
		};

		await issueClient.updateIssue(repoName, issueNumber, issueData);

		const subText = prMetaDataExists ? "updated in" : "added to";
		Utils.printAsGitHubNotice(`PR link metadata ${subText} the description of issue '${issueNumber}'.`);

		const allowedPRBaseBranches = await prTemplateManager.getAllowedPRBaseBranches();
		const prBaseBranchValid = allowedPRBaseBranches.some((branch) => branch === pr.base.ref);

		const prProjects: ProjectModel[] = await projectClient.getPullRequestProjects(repoName, prNumber);

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

		const [newPRSyncBody, statusOfSyncItems] = prTemplateManager.processSyncTemplate(prDescription, syncSettings);

		const syncPRData: IIssueOrPRRequestData = {
			title: issue.title,
			body: newPRSyncBody,
			state: pr.state as IssueState,
			state_reason: null,
			milestone: issue.milestone?.number ?? null,
			labels: issueLabels,
			assignees: issue.assignees?.map((i) => i.login) ?? [],
		};

		await prClient.updatePullRequest(repoName, prNumber, syncPRData);

		Utils.printAsGitHubNotices(statusOfSyncItems);
	}

	/**
	 * @inheritdoc
	 */
	protected async validateArgs(args: string[]): Promise<void> {
		if (args.length != 6) {
			let errorMsg = `The cicd script must have at 6 arguments but has ${args.length} arguments(s).`;
			errorMsg += "\nThe 1st arg is required and must be a valid organization name.";
			errorMsg += "\nThe 2nd arg is required and must be the GitHub repo name.";
			errorMsg += "\nThe 3rd arg is required and must be a valid GitHub user that triggered the script to run.";
			errorMsg += "\nThe 4th arg is required and must be a valid pull request number.";
			errorMsg += "\nThe 5th arg is required and must be a text that contains a sync command.";
			errorMsg += "\nThe 6th arg is required and must be a valid GitHub PAT (Personal Access Token).";
		
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
		
		this.printOrgRepoVarsUsed();

		const [orgName, repoName, requestByUser, prNumberStr, syncCommand] = args;

		const orgClient = new OrgClient(this.token);
		const repoClient = new RepoClient(this.token);
		const issueClient = new IssueClient(this.token);
		const prClient = new PullRequestClient(this.token);
		const usersClient = new UsersClient(this.token);

		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);

		if (Utils.isNumeric(prNumberStr)) {
			Utils.printAsGitHubError(`The given pull request number '${prNumberStr}' is not a valid number.`);
			Deno.exit(1);
		}

		const isRunSyncCommand = this.runSyncCommandRegex.test(syncCommand);
		const isInitialSyncCommand = this.initialSyncCommandRegex.test(syncCommand);
		
		// Validate that the comment contains the sync command
		if (!isRunSyncCommand && !isInitialSyncCommand) {
			Utils.printAsGitHubNotice("Sync ignored.  The 'sync-command' argument does not contain the '[initial-sync]' or '[run-sync]' command.");
			Deno.exit(0);
		}

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

		const prNumber = parseInt(prNumberStr);

		if (await issueClient.issueExists(repoName, prNumber)) {
			let ignoreMsg = `Sync ignored.  The pull request number is actually an issue number.`;
			ignoreMsg = "\nThis occurs when the '[run-sync]' command is used in an issue comment.";
			ignoreMsg += "\nThis command only works in pull request comments.";
		
			Utils.printAsGitHubNotice(ignoreMsg);
			Deno.exit(0);
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

		const prTemplateManager = new PRTemplateManager(orgName, repoName, this.token);

		// Check if syncing is disabled but only if a [run-sync] command
		if (isRunSyncCommand && prTemplateManager.syncingDisabled(pr.body)) {
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
			errorMsg += `\nVerify that the value of the '${SyncIssueToPRRunner.DEFAULT_PR_REVIEWER}' or/repo variable is correct.`;

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const issueNumber = this.getIssueFromFeatureBranch(headBranch);
		if (!(await issueClient.openIssueExists(repoName, issueNumber))) {
			let errorMsg = `An issue with the number '#${issueNumber}' parsed from the pull request `;
			errorMsg += `head branch '${headBranch}' does not exist.`;
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
	 * Prints the required org or repo variables for the runner.
	 */
	private printOrgRepoVarsUsed(): void {
		Utils.printInGroup("Required Org Or Repo Variables", this.getRequiredVars());
	}

	/* Gets the list of required vars.
	 * @returns The list of required vars.
	*/
   	private getRequiredVars(): string[] {
	   return [SyncIssueToPRRunner.DEFAULT_PR_REVIEWER,
		   SyncIssueToPRRunner.RELATIVE_PR_SYNC_TEMPLATE_FILE_PATH,
		   SyncIssueToPRRunner.PR_SYNC_TEMPLATE_REPO_NAME,
		   SyncIssueToPRRunner.PR_SYNC_TEMPLATE_BRANCH_NAME];
   }
}

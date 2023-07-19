import { GitClient } from "../../clients/GitClient.ts";
import { LabelClient } from "../../clients/LabelClient.ts";
import { MilestoneClient } from "../../clients/MilestoneClient.ts";
import { PullRequestClient } from "../../clients/PullRequestClient.ts";
import { GitHubLogType, ReleaseType } from "../../core/Enums.ts";
import { IssueModel } from "../../core/Models/IssueModel.ts";
import { LabelModel } from "../../core/Models/LabelModel.ts";
import { PullRequestModel } from "../../core/Models/PullRequestModel.ts";
import { GenerateReleaseNotesService } from "../../core/Services/GenerateReleaseNotesService.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";
import { GitHubVariableService } from "../../core/Services/GitHubVariableService.ts";
import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { CSharpVersionService } from "../../core/Services/CSharpVersionService.ts";

/**
 * Automates the process of generating release notes for a GitHub release.
 */
export class PrepareReleaseRunner extends ScriptRunner {
	private static readonly PREV_PREP_RELEASE_HEAD_BRANCH = "PREV_PREP_RELEASE_HEAD_BRANCH";
	private static readonly PREV_PREP_RELEASE_BASE_BRANCH = "PREV_PREP_RELEASE_BASE_BRANCH";
	private static readonly PROD_PREP_RELEASE_HEAD_BRANCH = "PROD_PREP_RELEASE_HEAD_BRANCH";
	private static readonly PROD_PREP_RELEASE_BASE_BRANCH = "PROD_PREP_RELEASE_BASE_BRANCH";
	private static readonly PREV_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH = "PREV_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH";
	private static readonly PROD_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH = "PROD_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH";
	private static readonly PREV_RELATIVE_RELEASE_NOTES_DIR_PATH = "PREV_RELATIVE_RELEASE_NOTES_DIR_PATH";
	private static readonly PROD_RELATIVE_RELEASE_NOTES_DIR_PATH = "PROD_RELATIVE_RELEASE_NOTES_DIR_PATH";
	private static readonly PR_RELEASE_TEMPLATE_REPO_NAME = "PR_RELEASE_TEMPLATE_REPO_NAME";
	private static readonly PR_RELEASE_TEMPLATE_BRANCH_NAME = "PR_RELEASE_TEMPLATE_BRANCH_NAME";
	private static readonly PR_INCLUDE_NOTES_LABEL = "PR_INCLUDE_NOTES_LABEL";
	private static readonly RELEASE_NOTES_FILE_NAME_PREFIX = "RELEASE_NOTES_FILE_NAME_PREFIX";
	private static readonly PREP_PROJ_RELATIVE_FILE_PATH = "PREP_PROJ_RELATIVE_FILE_PATH";
	private static readonly IGNORE_LABELS = "IGNORE_LABELS";
	private cachedRepoLabels: LabelModel[] = [];

	/**
	 * Initializes a new instance of the {@link SyncBotStatusCheckRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[]) {
		super(args);
	}

	/**
	 * Runs the generate release notes script.
	 */
	public async run(): Promise<void> {
		await super.run();

		const [orgName, repoName, releaseTypeArg, version] = this.args;

		const gitClient = new GitClient(orgName, repoName, this.token);
		const pullRequestClient = new PullRequestClient(this.token);

		// Print out all of the arguments
		Utils.printInGroup("Script Arguments", [
			`Organization Name (Required): ${orgName}`,
			`Repo Name (Required): ${repoName}`,
			`Release Type (Required): ${releaseTypeArg}`,
			`Version (Required): ${version}`,
			`GitHub Token (Required): ****`,
		]);

		const releaseType: ReleaseType = <ReleaseType> releaseTypeArg;

		await this.setupBranching(orgName, repoName, releaseType);

		const headBranch = await this.getHeadBranchName(orgName, repoName, releaseType);
		const baseBranch = await this.getBaseBranchName(orgName, repoName, releaseType);

		await gitClient.addCommit(headBranch, `start work for ${releaseType} release`);

		const prTemplate = await this.getReleaseTemplate(orgName, repoName, releaseType);
		const releaseTypeStr = Utils.firstLetterToUpper(releaseType);

		// Create a release pull request
		await pullRequestClient.createPullRequest(
			repoName,
			`🚀${releaseTypeStr} Release`,
			headBranch,
			baseBranch,
			prTemplate,
		);

		await this.updateProjectVersions(orgName, repoName, headBranch, version);
		await this.generateReleaseNotes(orgName, repoName, version, releaseType);
	}

	/**
	 * @inheritdoc
	 */
	protected async validateArgs(args: string[]): Promise<void> {
		// TODO: Print org and/or repo required/optional vars
		if (args.length != 5) {
			const argDescriptions = [
				`The cicd script must have 5 arguments but has ${args.length} argument(s).`,
				"Required and must be a valid GitHub organization name.",
				"Required and must be a valid GitHub repository name.",
				"Required and must be the type of release.\n\tValid values are 'production' and 'preview' and are case-insensitive.",
				"Required and must be a valid preview or production version.",
				"Required and must be a GitHub PAT (Personal Access Token).",
			];

			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.error);
			Deno.exit(1);
		}

		this.printOrgRepoVarsUsed();

		let [orgName, repoName, releaseType, version] = args;

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

		await this.checkThatAllVarsExist(orgName, repoName);

		this.validateVersionAndReleaseType(releaseType, version);
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [orgName, repoName, releaseType, version, token] = args;

		orgName = orgName.trim();
		repoName = repoName.trim();
		releaseType = releaseType.trim().toLowerCase();
		version = version.startsWith("v") ? version : `v${version}`;

		return [orgName, repoName, releaseType, version, token];
	}

	/**
	 * Checks that all of the required variables exist, and if not, prints out the missing variables
	 * and exists the script.
	 * @param orgName The name of the GitHub organization.
	 * @param repoName The name of the GitHub repository.
	 */
	private async checkThatAllVarsExist(orgName: string, repoName: string): Promise<void> {
		const orgRepoVariables = this.getRequiredVars();
		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);

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
	}

	/**
	 * Sets up the type of branching based on the given {@link releaseType}.
	 * @param releaseType The type of release.
	 */
	private async setupBranching(orgName: string, repoName: string, releaseType: ReleaseType): Promise<void> {
		const headBranch = await this.getHeadBranchName(orgName, repoName, releaseType);
		const baseBranch = await this.getBaseBranchName(orgName, repoName, releaseType);

		const gitClient = new GitClient(orgName, repoName, this.token);

		if (!gitClient.branchExists(baseBranch)) {
			let errorMsg = `The base branch '${baseBranch}' does not exist.`;
			errorMsg += "\nNo branch to create the release branch from.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		// If the head branch does not exist, create it
		if (!(await gitClient.branchExists(headBranch))) {
			const gitClient = new GitClient(orgName, repoName, this.token);
			await gitClient.createBranch(headBranch, baseBranch);
		}
	}

	/**
	 * Updates the version tags with the given {@link version} in a csproj file in a repository with a name that
	 * matches the given {@link repoName}, in the branch with the given {@link branchName}.
	 * @param repoName The name of the repository.
	 * @param branchName The name of the branch.
	 * @param version The version to update the csproj file with.
	 */
	private async updateProjectVersions(orgName: string, repoName: string, branchName: string, version: string): Promise<void> {
		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);

		const relativeProjFilePath = await githubVarService.getValue(PrepareReleaseRunner.PREP_PROJ_RELATIVE_FILE_PATH, false);
		const updateProjFileService = new CSharpVersionService(repoName, this.token);

		// Update the version tags in the csproj file
		await updateProjFileService.updateVersion(branchName, relativeProjFilePath, version);
	}

	/**
	 * Generates release notes for a repository with a name that matches the given {@link repoName}, that is in
	 * a GitHub organization with a name that matches the given {@link orgName}, for a release type that matches
	 * the given {@link releaseType}, and a version that matches the given {@link version}.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repository.
	 * @param version The version of the release.
	 * @param releaseType The type of release.
	 */
	private async generateReleaseNotes(
		orgName: string,
		repoName: string,
		version: string,
		releaseType: ReleaseType,
	): Promise<void> {
		const gitHubVariableService = new GitHubVariableService(orgName, repoName, this.token);
		const prIncludeLabel = await gitHubVariableService.getValue(PrepareReleaseRunner.PR_INCLUDE_NOTES_LABEL, false);
		const noPRLabel = Utils.isNullOrEmptyOrUndefined(prIncludeLabel);

		const repoClient = new RepoClient(this.token);
		const labelClient = new LabelClient(this.token);

		const prLabelGiven = !noPRLabel;

		const problemsFound: string[] = [];

		// Check that the pull request include label exists
		if (prLabelGiven) {
			const labelExists = await labelClient.labelExists(repoName, prIncludeLabel);

			if (!labelExists) {
				problemsFound.push(`The label '${prIncludeLabel}' does not exist in the repo '${repoName}'.`);
			}
		}

		// Filter out any issues that have a label included in the ignore label list
		const [issues, ignoredIssues] = await this.getMilestoneIssues(orgName, repoName, version);

		const releaseNoteGeneratorService = new GenerateReleaseNotesService();

		// Filter out any prs that have a label included in the ignore label list
		const [pullRequests, ignoredPullRequests] = await this.getMilestonePullRequests(
			orgName,
			repoName,
			version,
			prIncludeLabel,
		);

		const releaseNotes = releaseNoteGeneratorService.generateReleaseNotes(
			repoName,
			releaseType,
			version,
			issues,
			pullRequests,
		);
		const headBranch = await this.getHeadBranchName(orgName, repoName, releaseType);
		const releaseNotesFilePath = await this.buildReleaseNotesFilePath(orgName, repoName, version, releaseType);

		// Create a new release notes file
		await repoClient.createFile(
			repoName,
			headBranch,
			releaseNotesFilePath,
			releaseNotes,
			`release: create release notes for version ${version}`,
		);

		const ignoredItemList: string[] = [];

		if (ignoredIssues.length > 0) {
			ignoredIssues.forEach((issue) => {
				const issueUrl = Utils.buildIssueUrl(orgName, repoName, issue.number);
				ignoredItemList.push(`${issue.title} (Issue #${issue.number}) - ${issueUrl})}`);
			});
		}

		if (ignoredPullRequests.length > 0) {
			ignoredPullRequests.forEach((pr) => {
				const prUrl = Utils.buildPullRequestUrl(orgName, repoName, pr.number);
				ignoredItemList.push(`${pr.title} (PR #${pr.number}) - ${prUrl}`);
			});
		}

		Utils.printInGroup("Ignored Issues And PRs", ignoredItemList);
	}

	/**
	 * Gets the pull request release template for a release that matches the given {@link releaseType}.
	 * @param releaseType The type of release.
	 * @returns The release template.
	 */
	private async getReleaseTemplate(orgName: string, repoName: string, releaseType: ReleaseType): Promise<string> {
		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);

		let releaseTemplateVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				releaseTemplateVarName = PrepareReleaseRunner.PREV_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH;
				break;
			case ReleaseType.production:
				releaseTemplateVarName = PrepareReleaseRunner.PROD_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		const releaseTemplateRepoName = await githubVarService.getValue(
			PrepareReleaseRunner.PR_RELEASE_TEMPLATE_REPO_NAME,
			false,
		);
		const branchName = await githubVarService.getValue(PrepareReleaseRunner.PR_RELEASE_TEMPLATE_BRANCH_NAME, false);
		const relativeReleaseTemplateFilePath = Utils.normalizePath(
			await githubVarService.getValue(releaseTemplateVarName, false),
		);

		const repoClient = new RepoClient(this.token);

		return await repoClient.getFileContent(
			releaseTemplateRepoName,
			branchName,
			relativeReleaseTemplateFilePath,
		);
	}

	/**
	 * Gets the name of the head branch for a release that matches the given {@link releaseType}.
	 * @param releaseType The type of release.
	 * @returns The name of the head branch for the release.
	 */
	private async getHeadBranchName(orgName: string, repoName: string, releaseType: ReleaseType): Promise<string> {
		let branchVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				branchVarName = PrepareReleaseRunner.PREV_PREP_RELEASE_HEAD_BRANCH;
				break;
			case ReleaseType.production:
				branchVarName = PrepareReleaseRunner.PROD_PREP_RELEASE_HEAD_BRANCH;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);
		const branchName = await githubVarService.getValue(branchVarName)
			.catch((_) => {
				let errorMsg = `The script requires an organization or repository variable`;
				errorMsg += `\n named '${branchVarName}'.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		return branchName;
	}

	/**
	 * Gets the name of the base branch for a release that matches the given {@link releaseType}.
	 * @param releaseType The type of release.
	 * @returns The name of the base branch for the release.
	 */
	private async getBaseBranchName(orgName: string, repoName: string, releaseType: ReleaseType): Promise<string> {
		let branchVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				branchVarName = PrepareReleaseRunner.PREV_PREP_RELEASE_BASE_BRANCH;
				break;
			case ReleaseType.production:
				branchVarName = PrepareReleaseRunner.PROD_PREP_RELEASE_BASE_BRANCH;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);
		const branchName = await githubVarService.getValue(branchVarName)
			.catch((_) => {
				let errorMsg = `The script requires an organization or repository variable`;
				errorMsg += `\n named '${branchVarName}'.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		return branchName;
	}

	/**
	 * Gets the full file path to the release notes.
	 * @param version The version of the release notes.
	 * @param releaseType The type of release.
	 * @returns The full file path.
	 */
	private async buildReleaseNotesFilePath(
		orgName: string,
		repoName: string,
		version: string,
		releaseType: ReleaseType,
	): Promise<string> {
		const releaseNotesFileNamePrefix = await this.getFileNamePrefix(orgName, repoName);
		const relativeDirPath = this.getRelativeDirPath(orgName, repoName, releaseType);

		const fileName = `${releaseNotesFileNamePrefix}${version}.md`;
		const fullRelativeFilePath = `${relativeDirPath}/${fileName}`;

		let pathInfo = `\nRelative Directory Path: ${relativeDirPath}`;
		pathInfo += `\nFile Name: ${fileName}`;
		pathInfo += `\nFull Relative File Path: ${fullRelativeFilePath}`;

		Utils.printAsGitHubNotice(pathInfo);

		return fullRelativeFilePath;
	}

	/**
	 * Gets the relative directory path for the release notes.
	 * @param releaseType The type of release.
	 * @returns The relative directory path.
	 */
	private async getRelativeDirPath(orgName: string, repoName: string, releaseType: ReleaseType): Promise<string> {
		let relativeReleaseNotesDirPathVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				relativeReleaseNotesDirPathVarName = PrepareReleaseRunner.PREV_RELATIVE_RELEASE_NOTES_DIR_PATH;
				break;
			case ReleaseType.production:
				relativeReleaseNotesDirPathVarName = PrepareReleaseRunner.PROD_RELATIVE_RELEASE_NOTES_DIR_PATH;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);

		return Utils.normalizePath(await githubVarService.getValue(relativeReleaseNotesDirPathVarName));
	}

	/**
	 * Gets the prefix of the release notes file name.
	 * @returns The file name prefix.
	 */
	private async getFileNamePrefix(orgName: string, repoName: string): Promise<string> {
		return await new GitHubVariableService(orgName, repoName, this.token).getValue(
			PrepareReleaseRunner.RELEASE_NOTES_FILE_NAME_PREFIX,
		);
	}

	/**
	 * Gets a list of labels that will exclude issues in the release notes.
	 * @param repoName The name of the repository.
	 * @returns The list of ignore labels.
	 */
	private async getIgnoreLabels(orgName: string, repoName: string): Promise<string[]> {
		const labels: string[] = [];
		const githubVarService = new GitHubVariableService(orgName, repoName, this.token);
		const ignoreLabelsStr = await githubVarService.getValue(PrepareReleaseRunner.IGNORE_LABELS, false);

		if (Utils.isNullOrEmptyOrUndefined(ignoreLabelsStr)) {
			return labels;
		} else {
			const ignoreLabels = Utils.splitByComma(ignoreLabelsStr);
			labels.push(...ignoreLabels);
		}

		await this.validateLabelsExist(repoName, labels);

		return labels;
	}

	/**
	 * Gets all of the issues that are in a milestone with a title that matches the given {@link milestoneTitle},
	 * excluding any issues that have a label that are in the ignore label list.
	 * @param repoName The name of the repository.
	 * @param milestoneTitle The title of the milestone.
	 * @returns The issues in the milestone.
	 */
	private async getMilestoneIssues(
		orgName: string,
		repoName: string,
		milestoneTitle: string,
	): Promise<[IssueModel[], IssueModel[]]> {
		const ignoredIssues: IssueModel[] = [];
		const ignoreLabels: string[] = await this.getIgnoreLabels(orgName, repoName);

		const milestoneClient = new MilestoneClient(this.token);
		// Filter out any issues that have a label included in the ignore label list
		const issues = (await milestoneClient.getIssues(repoName, milestoneTitle))
			.filter((issue: IssueModel) => {
				if (ignoreLabels.length <= 0) {
					return true;
				}

				const shouldNotIgnore = ignoreLabels.every((ignoreLabel) =>
					issue.labels?.every((issueLabel) => issueLabel.name != ignoreLabel) ?? true
				);
				const shouldIgnore = !shouldNotIgnore;

				if (shouldIgnore) {
					ignoredIssues.push(issue);
				}

				return shouldNotIgnore;
			});

		return [issues, ignoredIssues];
	}

	/**
	 * Gets all of the pull requests that are in a milestone with a title that matches the given {@link milestoneTitle},
	 * and that has a label that matches the given {@link prIncludeLabel}.
	 * @param repoName The name of the repository.
	 * @param milestoneTitle The title of the milestone.
	 * @param prIncludeLabel The label on a pull request to include the pull request in the release notes.
	 * @returns The pull requests that are in the milestone.
	 */
	private async getMilestonePullRequests(
		orgName: string,
		repoName: string,
		milestoneTitle: string,
		prIncludeLabel: string,
	): Promise<[PullRequestModel[], PullRequestModel[]]> {
		const ignoredPullRequests: PullRequestModel[] = [];
		const ignoreLabels: string[] = await this.getIgnoreLabels(orgName, repoName);

		const milestoneClient = new MilestoneClient(this.token);
		const pullRequests = (await milestoneClient.getPullRequests(repoName, milestoneTitle))
			.filter((pr: PullRequestModel) => {
				const shouldNotIgnore = ignoreLabels.length <= 0 || ignoreLabels.every((ignoreLabel) => {
					return pr.labels?.every((prLabel) => prLabel.name != ignoreLabel) ?? true;
				});
				const shouldIgnore = !shouldNotIgnore;

				if (shouldIgnore) {
					ignoredPullRequests.push(pr);
				}

				return (pr.pull_request?.merged_at != null && shouldNotIgnore) &&
					pr.labels?.some((label) => label.name === prIncludeLabel);
			});

		return [pullRequests, ignoredPullRequests];
	}

	/**
	 * Validates that the given list of {@link labels} exist in a repository with a name
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repository that contains the labels.
	 * @param labels The list of labels to validate.
	 */
	private async validateLabelsExist(repoName: string, labels: string[]): Promise<void> {
		const repoLabels = await this.getLabels(repoName);

		const invalidLabels = labels.filter((ignoreLabel) => {
			return !repoLabels.some((label) => label.name === ignoreLabel);
		});

		if (invalidLabels.length > 0) {
			let errorMsg = `The following labels do not exist in the repository:\n`;
			errorMsg += invalidLabels.map((label) => ` - ${label}`).join("\n");

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
	}

	/**
	 * Gets all of the labels for a repository with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository that contains the labels.
	 * @returns The list of repository labels.
	 */
	private async getLabels(repoName: string): Promise<LabelModel[]> {
		if (this.cachedRepoLabels.length <= 0) {
			const labelClient = new LabelClient(this.token);
			const repoLabels: LabelModel[] = await labelClient.getAllLabels(repoName);

			this.cachedRepoLabels.push(...repoLabels);
		}

		return this.cachedRepoLabels;
	}

	/**
	 * Prints the required org or repo variables for the runner.
	 */
	private printOrgRepoVarsUsed(): void {
		const title = "Required Org Or Repo Variables (if release tweet is enabled)";
		Utils.printInGroup(title, this.getRequiredVars());
	}

	/**
	 * Gets the list of required vars.
	 * @returns The list of required vars.
	 */
	private getRequiredVars(): string[] {
		return [
			PrepareReleaseRunner.PREV_PREP_RELEASE_HEAD_BRANCH,
			PrepareReleaseRunner.PREV_PREP_RELEASE_BASE_BRANCH,
			PrepareReleaseRunner.PROD_PREP_RELEASE_HEAD_BRANCH,
			PrepareReleaseRunner.PROD_PREP_RELEASE_BASE_BRANCH,
			PrepareReleaseRunner.PREV_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH,
			PrepareReleaseRunner.PROD_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH,
			PrepareReleaseRunner.PREV_RELATIVE_RELEASE_NOTES_DIR_PATH,
			PrepareReleaseRunner.PROD_RELATIVE_RELEASE_NOTES_DIR_PATH,
			PrepareReleaseRunner.PR_RELEASE_TEMPLATE_REPO_NAME,
			PrepareReleaseRunner.PR_RELEASE_TEMPLATE_BRANCH_NAME,
			PrepareReleaseRunner.PR_INCLUDE_NOTES_LABEL,
			PrepareReleaseRunner.RELEASE_NOTES_FILE_NAME_PREFIX,
			PrepareReleaseRunner.PREP_PROJ_RELATIVE_FILE_PATH,
			PrepareReleaseRunner.IGNORE_LABELS,
		];
	}
}

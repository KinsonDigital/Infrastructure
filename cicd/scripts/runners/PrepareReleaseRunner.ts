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

/**
 * Automates the process of generating release notes for a GitHub release.
 */
export class PrepareReleaseRunner extends ScriptRunner {
	private readonly gitClient: GitClient;
	private readonly milestoneClient: MilestoneClient;
	private readonly labelClient: LabelClient;
	private readonly pullRequestClient: PullRequestClient;
	private readonly githubVarService: GitHubVariableService;
	private readonly scriptName: string;
	private readonly prevHeadBranchVarName = "PREV_PREP_RELEASE_HEAD_BRANCH";
	private readonly prevBaseBranchVarName = "PREV_PREP_RELEASE_BASE_BRANCH";
	private readonly prodHeadBranchVarName = "PROD_PREP_RELEASE_HEAD_BRANCH";
	private readonly prodBaseBranchVarName = "PROD_PREP_RELEASE_BASE_BRANCH";
	private readonly prevRelativePRReleaseTemplateFilePathVarName = "PREV_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH";
	private readonly prodRelativePRReleaseTemplateFilePathVarName = "PROD_RELATIVE_PR_RELEASE_TEMPLATE_FILE_PATH";
	private readonly prevRelativeReleaseNotesDirPathVarName = "PREV_RELATIVE_RELEASE_NOTES_DIR_PATH";
	private readonly prodRelativeReleaseNotesDirPathVarName = "PROD_RELATIVE_RELEASE_NOTES_DIR_PATH";
	private readonly prRelTemplateRepoNameVarName = "PR_RELEASE_TEMPLATE_REPO_NAME";
	private readonly prRelTemplateBranchVarName = "PR_RELEASE_TEMPLATE_BRANCH_NAME";
	private cachedRepoLabels: LabelModel[] = [];

	/**
	 * Initializes a new instance of the {@link SyncBotStatusCheckRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[], scriptName: string) {
		super(args);

		this.scriptName = scriptName;

		const [orgName, repoName, , , token] = this.args;

		this.gitClient = new GitClient(orgName, repoName, token);
		this.labelClient = new LabelClient(token);
		this.milestoneClient = new MilestoneClient(token);
		this.pullRequestClient = new PullRequestClient(token);
		this.githubVarService = new GitHubVariableService(orgName, repoName, token);
	}

	/**
	 * Runs the generate release notes script.
	 */
	public async run(): Promise<void> {
		const [orgName, repoName, releaseTypeArg, version] = this.args;

		// Print out all of the arguments
		Utils.printInGroup("Script Arguments", [
			`Organization Name (Required): ${orgName}`,
			`Repo Name (Required): ${repoName}`,
			`Release Type (Required): ${releaseTypeArg}`,
			`Version (Required): ${version}`,
			`GitHub Token (Required): ****`,
		]);

		const releaseType: ReleaseType = <ReleaseType> releaseTypeArg;

		await this.failIfOrgDoesNotExist(orgName);
		await this.failIfRepoDoesNotExist(repoName);

		await this.setupBranching(releaseType);

		const headBranch = await this.getHeadBranchName(releaseType);
		const baseBranch = await this.getBaseBranchName(releaseType);

		await this.gitClient.addCommit(headBranch, `start work for ${releaseType} release`);

		const prTemplate = await this.getReleaseTemplate(releaseType);
		const releaseTypeStr = Utils.firstLetterToUpper(releaseType);

		// Create a release pull request
		await this.pullRequestClient.createPullRequest(
			repoName,
			`🚀${releaseTypeStr} Release`,
			headBranch,
			baseBranch,
			prTemplate,
		);

		await this.generateReleaseNotes(orgName, repoName, version, releaseType);
	}

	/**
	 * @inheritdoc
	 */
	protected validateArgs(args: string[]): void {
		if (args.length != 5) {
			const argDescriptions = [
				`The cicd script must have 4 arguments.`,
				"Required and must be a valid GitHub organization name.",
				"Required and must be a valid GitHub repository name.",
				"Required and must be the type of release.\n\tValid values are 'production' and 'preview' and are case-insensitive.",
				"Required and must be a valid preview or production version.",
				"Required and must be a GitHub PAT (Personal Access Token).",
			];

			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.error);
			Deno.exit(1);
		}

		this.validateVersionAndReleaseType(args[2].trim().toLowerCase(), args[3].trim().toLowerCase());
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [orgName, repoName, releaseType, version, token] = args;

		releaseType = releaseType.trim().toLowerCase();
		version = version.startsWith("v") ? version : `v${version}`;

		return [orgName, repoName, releaseType, version, token];
	}

	private async setupBranching(releaseType: ReleaseType): Promise<void> {
		const headBranch = await this.getHeadBranchName(releaseType);
		const baseBranch = await this.getBaseBranchName(releaseType);

		if (!this.gitClient.branchExists(baseBranch)) {
			let errorMsg = `The base branch '${baseBranch}' does not exist.`;
			errorMsg += "\nNo branch to create the release branch from.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		// If the head branch does not exist, create it
		if (!(await this.gitClient.branchExists(headBranch))) {
			await this.gitClient.createBranch(headBranch, baseBranch);
		}
	}

	private async generateReleaseNotes(
		orgName: string,
		repoName: string,
		version: string,
		releaseType: ReleaseType,
	): Promise<void> {
		const prIncludeLabel = await this.getPullRequestIncludeLabel();
		const noPRLabel = Utils.isNullOrEmptyOrUndefined(prIncludeLabel);

		const prLabelGiven = !noPRLabel;

		const problemsFound: string[] = [];

		// Check that the pull request include label exists
		if (prLabelGiven) {
			const labelExists = await this.labelClient.labelExists(repoName, prIncludeLabel);

			if (!labelExists) {
				problemsFound.push(`The label '${prIncludeLabel}' does not exist in the repo '${repoName}'.`);
			}
		}

		const ignoredItemList: string[] = [];

		// Filter out any issues that have a label included in the ignore label list
		const [issues, ignoredIssues] = await this.getMilestoneIssues(repoName, version);

		// Filter out any prs that have a label included in the ignore label list
		const [pullRequests, ignoredPullRequests] = await this.getMilestonePullRequests(repoName, version, prIncludeLabel);

		const releaseNoteGeneratorService = new GenerateReleaseNotesService();

		const releaseNotes = releaseNoteGeneratorService.generateReleaseNotes(
			repoName,
			releaseType,
			version,
			issues,
			pullRequests,
		);
		const releaseNotesFilePath = await this.buildReleaseNotesFilePath(version, releaseType);
		const headBranch = await this.getHeadBranchName(releaseType);

		await this.repoClient.createFile(
			repoName,
			headBranch,
			releaseNotesFilePath,
			releaseNotes,
			`release: create release notes for version ${version}`,
		);

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

	private async getReleaseTemplate(releaseType: ReleaseType): Promise<string> {
		const repoName = await this.githubVarService.getValue(this.prRelTemplateRepoNameVarName, false);

		if (Utils.isNullOrEmptyOrUndefined(repoName)) {
			let noticeMsg = `A PR release template was not used because an organization or repository`;
			noticeMsg += ` variable named '${this.prRelTemplateRepoNameVarName}' does not exist.`;
			Utils.printAsGitHubNotice(noticeMsg);
			return "";
		}

		const branchName = await this.githubVarService.getValue(this.prRelTemplateBranchVarName, false);

		if (Utils.isNullOrEmptyOrUndefined(branchName)) {
			let noticeMsg = `A PR release template was not used because an organization or repository`;
			noticeMsg += ` variable named '${this.prRelTemplateBranchVarName}' does not exist.`;
			Utils.printAsGitHubNotice(noticeMsg);
			return "";
		}

		let releaseTemplateVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				releaseTemplateVarName = this.prevRelativePRReleaseTemplateFilePathVarName;
				break;
			case ReleaseType.production:
				releaseTemplateVarName = this.prodRelativePRReleaseTemplateFilePathVarName;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		let relativeReleaseTemplateFilePath = await this.githubVarService.getValue(releaseTemplateVarName, false);

		if (Utils.isNullOrEmptyOrUndefined(relativeReleaseTemplateFilePath)) {
			let noticeMsg = `A PR release template was not used because an organization or repository`;
			noticeMsg += ` variable named '${releaseTemplateVarName}' does not exist.`;
			Utils.printAsGitHubNotice(noticeMsg);
			return "";
		}

		relativeReleaseTemplateFilePath = Utils.normalizePath(relativeReleaseTemplateFilePath);

		return await this.repoClient.getFileContent(
			repoName,
			branchName,
			relativeReleaseTemplateFilePath,
		);
	}

	private async getHeadBranchName(releaseType: ReleaseType): Promise<string> {
		let branchVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				branchVarName = this.prevHeadBranchVarName;
				break;
			case ReleaseType.production:
				branchVarName = this.prodHeadBranchVarName;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		const branchName = await this.githubVarService.getValue(branchVarName)
			.catch((_) => {
				let errorMsg = `The script '${this.scriptName}' requires an organization or repository variable`;
				errorMsg += `\n named '${branchVarName}'.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		return branchName;
	}

	private async getBaseBranchName(releaseType: ReleaseType): Promise<string> {
		let branchVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				branchVarName = this.prevBaseBranchVarName;
				break;
			case ReleaseType.production:
				branchVarName = this.prodBaseBranchVarName;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		const branchName = await this.githubVarService.getValue(branchVarName)
			.catch((_) => {
				let errorMsg = `The script '${this.scriptName}' requires an organization or repository variable`;
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
	private async buildReleaseNotesFilePath(version: string, releaseType: ReleaseType): Promise<string> {
		const relativeDirPath = this.getRelativeDirPath(releaseType);
		const releaseNotesFileNamePrefix = await this.getFileNamePrefix();

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
	private async getRelativeDirPath(releaseType: ReleaseType): Promise<string> {
		let relativeReleaseNotesDirPathVarName = "";

		switch (releaseType) {
			case ReleaseType.preview:
				relativeReleaseNotesDirPathVarName = this.prevRelativeReleaseNotesDirPathVarName;
				break;
			case ReleaseType.production:
				relativeReleaseNotesDirPathVarName = this.prodRelativeReleaseNotesDirPathVarName;
				break;
			default:
				Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
				Deno.exit(1);
		}

		let relativeDirPath = await this.githubVarService.getValue(relativeReleaseNotesDirPathVarName)
			.catch((_) => {
				let errorMsg = `The '${this.scriptName}' cicd script requires an organization or repository`;
				errorMsg += `\n variable named '${relativeReleaseNotesDirPathVarName}'.`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		relativeDirPath = Utils.normalizePath(relativeDirPath);

		return relativeDirPath;
	}

	/**
	 * Gets the prefix of the release notes file name.
	 * @returns The file name prefix.
	 */
	private async getFileNamePrefix(): Promise<string> {
		const releaseNotesFileNamePrefixVarName = "RELEASE_NOTES_FILE_NAME_PREFIX";

		const releaseNotesFileNamePrefix = await this.githubVarService.getValue(releaseNotesFileNamePrefixVarName)
			.catch((_) => {
				let errorMsg = `The '${this.scriptName}' cicd script requires an organization`;
				errorMsg += `\n or repository variable named '${releaseNotesFileNamePrefixVarName}'`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			});

		return releaseNotesFileNamePrefix;
	}

	/**
	 * Gets a list of labels that will exclude issues in the release notes.
	 * @param repoName The name of the repository.
	 * @returns The list of ignore labels.
	 */
	private async getIgnoreLabels(repoName: string): Promise<string[]> {
		const labels: string[] = [];

		const ignoreLabelsVarName = "IGNORE_LABELS";

		const ignoreLabelsStr = await this.githubVarService.getValue(ignoreLabelsVarName, false);

		if (Utils.isNullOrEmptyOrUndefined(ignoreLabelsStr)) {
			return [];
		} else {
			const ignoreLabels = Utils.splitByComma(ignoreLabelsStr);
			labels.push(...ignoreLabels);
		}

		await this.validateLabelsExist(repoName, labels);

		return labels;
	}

	/**
	 * Gets the name of the label that includes pull requests into the release notes.
	 * @returns The name of the label.
	 */
	private async getPullRequestIncludeLabel(): Promise<string> {
		const prLabelRepoVarName = "PR_INCLUDE_NOTES_LABEL";

		return await this.githubVarService.getValue(prLabelRepoVarName, false);
	}

	/**
	 * Gets all of the issues that are in a milestone with a title that matches the given {@link milestoneTitle},
	 * excluding any issues that have a label that are in the ignore label list.
	 * @param repoName The name of the repository.
	 * @param milestoneTitle The title of the milestone.
	 * @returns The issues in the milestone.
	 */
	private async getMilestoneIssues(repoName: string, milestoneTitle: string): Promise<[IssueModel[], IssueModel[]]> {
		const ignoredIssues: IssueModel[] = [];
		const ignoreLabels: string[] = await this.getIgnoreLabels(repoName);

		// Filter out any issues that have a label included in the ignore label list
		const issues = (await this.milestoneClient.getIssues(repoName, milestoneTitle))
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
		repoName: string,
		milestoneTitle: string,
		prIncludeLabel: string,
	): Promise<[PullRequestModel[], PullRequestModel[]]> {
		const ignoredPullRequests: PullRequestModel[] = [];
		const ignoreLabels: string[] = await this.getIgnoreLabels(repoName);

		const pullRequests = (await this.milestoneClient.getPullRequests(repoName, milestoneTitle))
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
			const repoLabels: LabelModel[] = await this.labelClient.getAllLabels(repoName);

			this.cachedRepoLabels.push(...repoLabels);
		}

		return this.cachedRepoLabels;
	}
}

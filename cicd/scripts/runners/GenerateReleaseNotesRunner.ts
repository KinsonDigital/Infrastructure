import { LabelClient } from "../../clients/LabelClient.ts";
import { MilestoneClient } from "../../clients/MilestoneClient.ts";
import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { GitHubLogType, ReleaseType } from "../../core/Enums.ts";
import { File } from "../../core/File.ts";
import { IssueModel } from "../../core/Models/IssueModel.ts";
import { LabelModel } from "../../core/Models/LabelModel.ts";
import { PullRequestModel } from "../../core/Models/PullRequestModel.ts";
import { RepoVarModel } from "../../core/Models/RepoVarModel.ts";
import { GenerateReleaseNotesService } from "../../core/Services/GenerateReleaseNotesService.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Automates the process of generating release notes for a GitHub release.
 */
export class GenerateReleaseNotesRunner extends ScriptRunner {
	private readonly repoClient: RepoClient;
	private readonly orgClient: OrgClient;
	private readonly scriptName: string;
	private vars: RepoVarModel[] = [];
	private readonly milestoneClient: MilestoneClient;
	private readonly labelClient: LabelClient;
	private cachedRepoLabels: LabelModel[] = [];

	/**
	 * Initializes a new instance of the {@link SyncBotStatusCheckRunner} class.
	 * @param args The script arguments.
	 * @param scriptName The name of the script executing the runner.
	 */
	constructor(args: string[], scriptName: string) {
		if (args.length != 6) {
			const argDescriptions = [
				`The ${scriptName} cicd script must have 4 arguments.`,
				"Required and must be a valid GitHub organization name.",
				"Required and must be a valid GitHub repository name.",
				"Required and must be the type of release.\n\tValid values are 'production' and 'preview' and are case-insensitive.",
				"Required and must be a valid preview or production version.",
				"Required and must be a valid directory path.",
				"Required and must be a GitHub PAT (Personal Access Token).",
			];

			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.error);
			Deno.exit(1);
		}
		
		super(args);

		this.scriptName = scriptName;

		const token = this.args[5].trim();
		this.orgClient = new OrgClient(token);
		this.repoClient = new RepoClient(token);
		this.labelClient = new LabelClient(token);
		this.milestoneClient = new MilestoneClient(token);
	}

	/**
	 * Runs the generate release notes script.
	 */
	public async run(): Promise<void> {
		let [orgName, repoName, releaseTypeArg, version, baseDirPath, _] = this.args;

		// Print out all of the arguments
		Utils.printInGroup("Script Arguments", [
			`Organization Name (Required): ${orgName}`,
			`Repo Name (Required): ${repoName}`,
			`Release Type (Required): ${releaseTypeArg}`,
			`Version (Required): ${version}`,
			`Base Directory Path (Required): ${baseDirPath}`,
			`GitHub Token (Required): ****`,
		]);

		version = version.startsWith("v") ? version : `v${version}`;
		releaseTypeArg = releaseTypeArg.trim().toLowerCase();
		
		const releaseType: ReleaseType = <ReleaseType>releaseTypeArg;

		const repoDoesNotExist = !(await this.repoClient.repoExists(repoName));

		if (repoDoesNotExist) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		this.vars = await this.getVars(orgName, repoName);

		const prIncludeLabel = this.getPullRequestIncludeLabel();
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

		const releaseNotes = releaseNoteGeneratorService.generateReleaseNotes(repoName, releaseType, version, issues, pullRequests);
		const releaseNotesFilePath = this.buildReleaseNotesFilePath(baseDirPath, version, releaseType);

		File.SaveFile(releaseNotesFilePath, releaseNotes);

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
	 * @inheritdoc
	 */
	protected validateArgs(args: string[]): void {
		this.validateVersionAndReleaseType(args[2].trim().toLowerCase(), args[3].trim().toLowerCase());
	}

	/**
	 * Gets all of the organization and repo variables.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repo.
	 * @returns The list of variables.
	 */
	private async getVars(orgName: string, repoName: string): Promise<RepoVarModel[]> {
		const orgVars: RepoVarModel[] = await this.orgClient.getVariables(orgName);
		const repoVars: RepoVarModel[] = await this.repoClient.getVariables(repoName);

		const allVars: RepoVarModel[] = [];

		const repoVarsNotInOrg = repoVars.filter((repoVar) =>
			orgVars.find((orgVar) => orgVar.name === repoVar.name) === undefined
		);

		allVars.push(...orgVars);
		allVars.push(...repoVarsNotInOrg);

		return allVars;
	}

	/**
	 * Gets the full file path to the release notes.
	 * @param baseDirPath The name of the organization.
	 * @param version The version of the release notes.
	 * @param releaseType The type of release.
	 * @returns The full file path.
	 */
	private buildReleaseNotesFilePath(baseDirPath: string, version: string, releaseType: ReleaseType): string {
		const relativeDirPath = this.getRelativeDirPath(releaseType);
		const releaseNotesFileNamePrefix = this.getFileNamePrefix();

		const fileName = `${releaseNotesFileNamePrefix}${version}.md`;
		const fullFilePath = `${baseDirPath}/${relativeDirPath}/${fileName}`;

		let pathInfo = `\nBase Directory Path: ${baseDirPath}`;
		pathInfo += `\nRelative Directory Path: ${relativeDirPath}`;
		pathInfo += `\nFile Name: ${fileName}`;
		pathInfo += `\nFull File Path: ${fullFilePath}`;

		Utils.printAsGitHubNotice(pathInfo);

		return fullFilePath;
	}
	
	/**
	 * Gets the relative directory path for the release notes.
	 * @param releaseType The type of release.
	 * @returns The relative directory path.
	 */
	private getRelativeDirPath(releaseType: ReleaseType): string {
		const relativePrevReleaseNotesDirPathVarName = "RELATIVE_PREV_RELEASE_NOTES_DIR_PATH";
		const relativeProdReleaseNotesDirPathVarName = "RELATIVE_PROD_RELEASE_NOTES_DIR_PATH";

		let relativeDirPath = "";

		if (releaseType === ReleaseType.production) {
			const relativeProdReleaseNotesDirPathVar = this.vars.find((variable) =>
				variable.name === relativeProdReleaseNotesDirPathVarName
			);

			if (relativeProdReleaseNotesDirPathVar === undefined) {
				let errorMsg = `The '${this.scriptName}' cicd script requires an organization`;
				errorMsg += `\n or repository variable named '${relativeProdReleaseNotesDirPathVarName}'`;
				errorMsg += " with a valid relative file path.";
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}

			relativeDirPath = relativeProdReleaseNotesDirPathVar.value.trim();
		} else {
			const relativePrevReleaseNotesDirPathVar = this.vars.find((variable) =>
				variable.name === relativePrevReleaseNotesDirPathVarName
			);

			if (relativePrevReleaseNotesDirPathVar === undefined) {
				let errorMsg = `The '${this.scriptName}' cicd script requires an organization`;
				errorMsg += `\n or repository variable named '${relativePrevReleaseNotesDirPathVarName}'`;
				errorMsg += " with a valid relative file path.";
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}

			relativeDirPath = relativePrevReleaseNotesDirPathVar.value.trim();
		}

		relativeDirPath = relativeDirPath.replaceAll("\\", "/");
		relativeDirPath = relativeDirPath.replaceAll("//", "/");

		relativeDirPath = relativeDirPath.startsWith("/") ? relativeDirPath.substring(1) : relativeDirPath;
		relativeDirPath = relativeDirPath.endsWith("/")
			? relativeDirPath.substring(0, relativeDirPath.length - 1)
			: relativeDirPath;

		return relativeDirPath;
	}

	/**
	 * Gets the prefix of the release notes file name.
	 * @returns The file name prefix.
	 */
	private getFileNamePrefix(): string {
		const releaseNotesFileNamePrefixVarName = "RELEASE_NOTES_FILE_NAME_PREFIX";

		const releaseNotesFileNamePrefixVar = this.vars.find((variable) => variable.name === releaseNotesFileNamePrefixVarName);

		if (releaseNotesFileNamePrefixVar === undefined) {
			let errorMsg = `The '${this.scriptName}' cicd script requires an organization`;
			errorMsg += `\n or repository variable named '${releaseNotesFileNamePrefixVarName}'`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		return releaseNotesFileNamePrefixVar.value;
	}

	/**
	 * Gets a list of labels that will exclude issues in the release notes.
	 * @param repoName The name of the repository.
	 * @returns The list of ignore labels.
	 */
	private async getIgnoreLabels(repoName: string): Promise<string[]> {
		const labels: string[] = [];

		const ignoreLabelsVarName = "IGNORE_LABELS";

		const ignoreLabelsVar = this.vars.find((variable) => variable.name === ignoreLabelsVarName);

		if (ignoreLabelsVar === undefined) {
			return [];
		} else {
			const varValue = ignoreLabelsVar.value.trim();

			if (varValue.indexOf(",") === -1) {
				labels.push(varValue);
			} else {
				const ignoreLabels = ignoreLabelsVar.value.split(",").map((label) => label.trim());

				labels.push(...ignoreLabels);
			}
		}

		await this.validateLabelsExist(repoName, labels);

		return labels;
	}

	/**
	 * Gets the name of the label that includes pull requests into the release notes.
	 * @returns The name of the label.
	 */
	private getPullRequestIncludeLabel(): string {
		const prLabelRepoVarName = "PR_INCLUDE_NOTES_LABEL";

		return this.vars.find((v) => v.name == prLabelRepoVarName)?.value ?? "";
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

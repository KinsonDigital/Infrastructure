import { ScriptRunner } from "./ScriptRunner.ts";
import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { LabelClient } from "../../clients/LabelClient.ts";
import { MilestoneClient } from "../../clients/MilestoneClient.ts";
import { Utils } from "../../core/Utils.ts";
import { IRepoVarModel } from "../../core/Models/IRepoVarModel.ts";
import { File } from "../../core/File.ts";
import { IIssueModel } from "../../core/Models/IIssueModel.ts";
import { IPullRequestModel } from "../../core/Models/IPullRequestModel.ts";
import { ILabelModel } from "../../core/Models/ILabelModel.ts";

/**
 * Used to validate release notes.
 */
export class ValidateReleaseNotesRunner extends ScriptRunner {
	private readonly repoClient: RepoClient;
	private readonly labelClient: LabelClient;
	private readonly milestoneClient: MilestoneClient;
	private readonly orgClient: OrgClient;
	private readonly scriptName: string;
	private readonly issueLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/issues\/[0-9]*\)/gm;
	private readonly prLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/pull\/[0-9]*\)/gm;
	private vars: IRepoVarModel[] = [];
	private cachedRepoLabels: ILabelModel[] = [];

	/**
	 * Creates a new instance of the {@link ValidateReleaseNotesRunner} class.
	 * @param args The arguments to process.
	 * @param scriptName The name of the script.
	 */
	constructor(args: string[], scriptName: string) {
		if (args.length != 5) {
			const argInfos: string[] = [];

			for (let i = 0; i < args.length - 1; i++) {
				argInfos.push(`${Utils.toOrdinal(i + 1)} Arg: $`);
			}

			argInfos[0] = argInfos[0]
				.replace("$", "Required and must be a valid GitHub organization name.");
			argInfos[1] = argInfos[1]
				.replace("$", "Required and must be a valid GitHub repository name.");

			let typeOfReleaseMsg = "Required and must be the type of release.";
			typeOfReleaseMsg += "\n\tValid values are 'production' and 'preview' and are case-insensitive.";
			argInfos[2] = argInfos[2].replace("$", typeOfReleaseMsg);
			argInfos[3] = argInfos[3].replace("$", "Required and must be a valid preview or production version.");
			argInfos[4] = argInfos[4].replace("$", "Required and must be a GitHub PAT (Personal Access Token).");

			argInfos.unshift(`The ${scriptName} cicd script must have 5 arguments.`);

			Utils.printAsGitHubError(argInfos.join("\n"));
			Deno.exit(1);
		}

		super(args);

		this.scriptName = scriptName;

		const token = args[4].trim();
		this.orgClient = new OrgClient(token);
		this.repoClient = new RepoClient(token);
		this.labelClient = new LabelClient(token);
		this.milestoneClient = new MilestoneClient(token);
	}

	/**
	 * Runs the validate release notes script.
	 */
	public async run(): Promise<void> {
		await super.run();

		let [orgName, repoName, releaseType, version, _] = this.args;

		// Print out all of the arguments
		Utils.printInGroup("Script Arguments", [
			`Organization Name (Required): ${orgName}`,
			`Repo Name (Required): ${repoName}`,
			`Release Type (Required): ${releaseType}`,
			`Version (Required): ${version}`,
			`GitHub Token (Required): ****`,
		]);

		version = version.startsWith("v") ? version : `v${version}`;
		releaseType = releaseType.toLowerCase();

		const repoDoesNotExist = !(await this.repoClient.repoExists(repoName));

		if (repoDoesNotExist) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		this.vars = await this.getVars(orgName, repoName);

		const releaseNotesFilePath = this.buildReleaseNotesFilePath(orgName, version, releaseType);
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

		const releaseNoteFileData: string = File.LoadFile(releaseNotesFilePath);
		const issueLinks: string[] = releaseNoteFileData.match(this.issueLinkRegex) ?? [];
		const prLinks: string[] = noPRLabel ? [] : releaseNoteFileData.match(this.prLinkRegex) ?? [];

		const releaseTypeTitle = this.getReleaseNotesTitle(repoName, version, releaseType);

		const titleRegex = new RegExp(releaseTypeTitle, "gm");

		// If the title is incorrect, add to the list of errors found
		if (releaseNoteFileData.match(titleRegex) === null) {
			let problemMsg = `The title of the release notes is incorrect.`;
			problemMsg += ` Expected '${releaseTypeTitle} ${releaseType} Release Notes - ${version}'.`;
			problemsFound.push(problemMsg);
		}

		// Check that all of the issues exist in the release notes
		issues.forEach((issue) => {
			const issueLink = `[#${issue.number}](${issue.html_url})`;

			if (!issueLinks.includes(issueLink)) {
				problemsFound.push(`The issue link for issue '${issue.number}' does not exist in the release notes.`);
			}
		});

		pullRequests.forEach((pr) => {
			const prLink = `[#${pr.number}](${pr.html_url})`;

			if (!prLinks.includes(prLink)) {
				let problemMsg = `The pr link for issue '${pr.number}' with the label '${prIncludeLabel}'`;
				problemMsg += ` does not exist in the release notes.`;
				problemsFound.push(problemMsg);
			}
		});

		const successMsg = `✅The release notes for version '${version}' are valid!!✅`;
		const failureMsg = `❌There were issues with the '${version}' release notes.❌`;

		Utils.printProblemList(problemsFound, successMsg, failureMsg);

		if (problemsFound.length > 0) {
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected validateArgs(args: string[]): void {
		const releaseType = args[2].trim().toLowerCase();
		let version = args[3].trim().toLowerCase();

		version = version.startsWith("v") ? version : `v${version}`;

		if (releaseType != "production" && releaseType != "preview") {
			Utils.printAsGitHubError(`The release type must be either 'production' or 'preview'.`);
			Deno.exit(1);
		}

		if (releaseType == "production") {
			if (Utils.isNotValidProdVersion(version)) {
				let errorMsg = `The production version '${version}' is not valid.`;
				errorMsg += "\nRequired Syntax: v#.#.#";
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		} else {
			if (Utils.isNotValidPreviewVersion(version)) {
				let errorMsg = `The preview version '${version}' is not valid.`;
				errorMsg += "\nRequired Syntax: v#.#.#-preview.#";
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		}
	}

	/**
	 * Gets all of the organization and repo variables.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repo.
	 * @returns The list of variables.
	 */
	private async getVars(orgName: string, repoName: string): Promise<IRepoVarModel[]> {
		const orgVars: IRepoVarModel[] = await this.orgClient.getVariables(orgName);
		const repoVars: IRepoVarModel[] = await this.repoClient.getVariables(repoName);

		const allVars: IRepoVarModel[] = [];

		const repoVarsNotInOrg = repoVars.filter((repoVar) =>
			orgVars.find((orgVar) => orgVar.name === repoVar.name) === undefined
		);

		allVars.push(...orgVars);
		allVars.push(...repoVarsNotInOrg);

		return allVars;
	}

	/**
	 * Gets the full file path to the release notes.
	 * @param orgName The name of the organization.
	 * @param version The version of the release notes.
	 * @param releaseType The type of release.
	 * @returns The full file path.
	 */
	private buildReleaseNotesFilePath(orgName: string, version: string, releaseType: string): string {
		const relativeDirPath = this.getRelativeDirPath(orgName);
		const releaseNotesFileNamePrefix = this.getFileNamePrefix();

		const baseDirPath = Deno.cwd().replaceAll("\\", "/");
		const fileName = `${releaseNotesFileNamePrefix}${version}.md`;
		const fullFilePath = `${baseDirPath}/${relativeDirPath}/${fileName}`;

		let pathInfo = `\nBase Directory Path: ${baseDirPath}`;
		pathInfo += `\nRelative Directory Path: ${relativeDirPath}`;
		pathInfo += `\nFile Name: ${fileName}`;
		pathInfo += `\nFull File Path: ${fullFilePath}`;

		Utils.printAsGitHubNotice(pathInfo);

		if (File.DoesNotExist(fullFilePath)) {
			Utils.printAsGitHubError(`The ${releaseType} release notes '${fullFilePath}' does not exist.`);
			Deno.exit(1);
		}

		return fullFilePath;
	}

	/**
	 * Gets the relative directory path for the release notes.
	 * @param releaseType The type of release.
	 * @returns The relative directory path.
	 */
	private getRelativeDirPath(releaseType: string): string {
		const relativePrevReleaseNotesDirPathVarName = "RELATIVE_PREV_RELEASE_NOTES_DIR_PATH";
		const relativeProdReleaseNotesDirPathVarName = "RELATIVE_PROD_RELEASE_NOTES_DIR_PATH";

		let relativeDirPath = "";

		if (releaseType === "production") {
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
	 * Gets the title of the release notes using the given {@link repoName}, {@link version}, and {@link releaseType}.
	 * @param repoName The name of the repository.
	 * @param version The version of the release.
	 * @param releaseType The type of release.
	 * @returns The title of the release notes.
	 */
	private getReleaseNotesTitle(repoName: string, version: string, releaseType: string): string {
		const titleSection = Utils.firstLetterToUpper(releaseType);

		return `${repoName} ${titleSection} Release Notes - ${version}`;
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
	private async getMilestoneIssues(repoName: string, milestoneTitle: string): Promise<[IIssueModel[], IIssueModel[]]> {
		const ignoredIssues: IIssueModel[] = [];
		const ignoreLabels: string[] = await this.getIgnoreLabels(repoName);

		// Filter out any issues that have a label included in the ignore label list
		const issues = (await this.milestoneClient.getIssues(repoName, milestoneTitle))
			.filter((issue: IIssueModel) => {
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
	): Promise<[IPullRequestModel[], IPullRequestModel[]]> {
		const ignoredPullRequests: IPullRequestModel[] = [];
		const ignoreLabels: string[] = await this.getIgnoreLabels(repoName);

		const pullRequests = (await this.milestoneClient.getPullRequests(repoName, milestoneTitle))
			.filter((pr: IPullRequestModel) => {
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
	private async getLabels(repoName: string): Promise<ILabelModel[]> {
		if (this.cachedRepoLabels.length <= 0) {
			const repoLabels: ILabelModel[] = await this.labelClient.getAllLabels(repoName);

			this.cachedRepoLabels.push(...repoLabels);
		}

		return this.cachedRepoLabels;
	}
}

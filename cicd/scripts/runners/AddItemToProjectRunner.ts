import { IssueClient } from "../../clients/IssueClient.ts";
import { OrgClient } from "../../clients/OrgClient.ts";
import { ProjectClient } from "../../clients/ProjectClient.ts";
import { PullRequestClient } from "../../clients/PullRequestClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Adds an issue or pull request to a V2 GitHub project.
 */
export class AddItemToProjectRunner extends ScriptRunner {
	private readonly projectClient: ProjectClient;
	private readonly issueClient: IssueClient;
	private readonly prClient: PullRequestClient;

	/**
	 * Initializes a new instance of the {@link AddItemToProjectRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		super(args);

		this.projectClient = new ProjectClient(this.token);
		this.issueClient = new IssueClient(this.token);
		this.prClient = new PullRequestClient(this.token);
	}

	/**
	 * Runs the runner to add the item to the project.
	 */
	public async run(): Promise<void> {
		await super.run();

		const [, projectName, repoName, issueOrPRNumberStr] = this.args;

		const issueOrPrNumber = parseInt(issueOrPRNumberStr);

		const isIssueNumber = await this.issueClient.issueExists(repoName, issueOrPrNumber);
		const isPRNumber = await this.prClient.pullRequestExists(repoName, issueOrPrNumber);

		const contentId = isIssueNumber && !isPRNumber
			? (await this.issueClient.getIssue(repoName, issueOrPrNumber)).node_id ?? ""
			: (await this.prClient.getPullRequest(repoName, issueOrPrNumber)).node_id ?? "";

		await this.projectClient.addToProject(contentId, projectName);

		const itemType = isIssueNumber && !isPRNumber ? "issue" : "pull request";

		Utils.printAsGitHubNotice(`The ${itemType} has been added to the ${projectName} project.`);
	}

	/**
	 * @inheritdoc
	 */
	protected async validateArgs(args: string[]): Promise<void> {
		if (args.length != 5) {
			let errorMsg = `The cicd script must have at 5 arguments but has ${args.length} arguments(s).`;
			errorMsg += "\nThe 1st arg is required and must be a valid organization name.";
			errorMsg += "\nThe 2nd arg is required and must be a valid GitHub V2 project name.";
			errorMsg += "\nThe 3rd arg is required and must be the GitHub repo name.";
			errorMsg += "\nThe 4th arg is required and must be a valid issue or pull request number.";
			errorMsg += "\nThe 5th arg is required and must be a valid GitHub PAT (Personal Access Token).";

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const [orgName, projectName, repoName, issueOrPRNumberStr, token] = args;

		const orgClient = new OrgClient(token);
		const repoClient = new RepoClient(token);

		if (!Utils.isNumeric(issueOrPRNumberStr)) {
			Utils.printAsGitHubError(`The given issue or pull request number '${issueOrPRNumberStr}' is not a valid number.`);
			Deno.exit(1);
		}

		if (!(await orgClient.exists(orgName))) {
			Utils.printAsGitHubError(`The organization '${orgName}' does not exist.`);
			Deno.exit(1);
		}

		if (!(await repoClient.exists(repoName))) {
			Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
			Deno.exit(1);
		}

		if (!(await this.projectClient.exists(projectName))) {
			Utils.printAsGitHubError(`The V2 project '${projectName}' does not exist.`);
			Deno.exit(1);
		}
		const issueOrPrNumber = parseInt(issueOrPRNumberStr);

		const isIssueNumber = await this.issueClient.issueExists(repoName, issueOrPrNumber);
		const isPRNumber = await this.prClient.pullRequestExists(repoName, issueOrPrNumber);

		// If the issue or PR number does not exist
		if (!isIssueNumber && !isPRNumber) {
			Utils.printAsGitHubError(`The issue or pull request number '${issueOrPrNumber}' does not exist.`);
			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [orgName, projectName, repoName, issueOrPRNumberStr, token] = args;

		orgName = orgName.trim();
		projectName = projectName.trim();
		repoName = repoName.trim();
		issueOrPRNumberStr = issueOrPRNumberStr.trim();
		token = token.trim();

		return [orgName, projectName, repoName, issueOrPRNumberStr, token];
	}
}

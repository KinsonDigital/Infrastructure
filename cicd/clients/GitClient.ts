import { GitHubHttpStatusCodes } from "../core/Enums.ts";
import { GitHubClient } from "../core/GitHubClient.ts";
import { Guard } from "../core/Guard.ts";
import { IGitBranch } from "../core/Models/IGitBranch.ts";
import { IGitRef } from "../core/Models/IGitRef.ts";
import { Utils } from "../core/Utils.ts";

/**
 * Provides a client for interacting with GitHub GIT repositories.
 */
export class GitClient extends GitHubClient {
	private readonly repoOwner: string;
	private readonly repoName: string;
	
	/**
	 * Initializes a new instance of the {@link GitClient} class.
	 * @param repoOwner The owner of the repository.
	 * @param repoName The name of the repository.
	 * @param token The GitHub token to use for authentication.
	 * @remarks If no {@link token} is provided, the {@link GitClient} will not be able to perform
	 * operations that require authentication.
	 */
	constructor(repoOwner: string, repoName: string, token?: string) {
		const funcName = "GitClient.Ctor";
		Guard.isNullOrEmptyOrUndefined(repoOwner, funcName, "repoOwner");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");

		super(token);

		this.repoOwner = repoOwner;
		this.repoName = repoName;
	}

	/**
	 * Gets a branch with the given branch {@link name}.
	 * @param name The name of the branch.
	 * @returns The branch.
	 * @remarks Does not require authentication.
	 */
	public async getBranch(name: string): Promise<IGitBranch> {
		Guard.isNullOrEmptyOrUndefined(name, "getBranch", "name");

		const branches = await this.getBranches();

		const branch = branches.find((b) => b.name === name);

		if (branch === undefined) {
			const errorMsg = `The branch '${branch}' was not found.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		return branch;
	}

	/**
	 * Gets a list of branches for a repository.
	 * @returns The list of branches for the repository.
	 * @remarks Does not require authentication.
	 */
	public async getBranches(): Promise<IGitBranch[]> {
		const url = `${this.baseUrl}/repos/${this.repoOwner}/${this.repoName}/git/matching-refs/heads`;

		const response = await this.fetchGET(url);

		if (response.status != GitHubHttpStatusCodes.OK) {
			Utils.printAsGitHubError(`Error: ${response.status}(${response.statusText})`);
			Deno.exit(1);
		}

		const gitRefs = <IGitRef[]> await response.json();

		const gitBranches: IGitBranch[] = gitRefs.map((gitRef) => {
			return {
				name: gitRef.ref.replace("refs/heads/", ""),
				sha: gitRef.object.sha,
			};
		});

		return gitBranches;
	}

	/**
	 * Gets a value indicating whether or not a branch with the given branch {@link name} exists.
	 * @param name The name of the branch.
	 * @returns True if the branch exists; otherwise, false.
	 * @remarks Does not require authentication.
	 */
	public async branchExists(name: string): Promise<boolean> {
		Guard.isNullOrEmptyOrUndefined(name, "branchExists", "name");

		const branches = await this.getBranches();

		return branches.some((branch) => branch.name === name);
	}

	/**
	 * Creates a branch with the given {@link newBranchName} from a branch that matches the given {@link branchFromName}.
	 * @param newBranchName The name of the branch.
	 * @remarks Requires authentication.
	 */
	public async createBranch(newBranchName: string, branchFromName: string): Promise<IGitBranch> {
		const funcName = "createBranch";
		Guard.isNullOrEmptyOrUndefined(newBranchName, funcName, "newBranchName");
		Guard.isNullOrEmptyOrUndefined(branchFromName, funcName, "branchFromName");

		if (await this.branchExists(newBranchName)) {
			const errorMsg = `A branch with the name '${newBranchName}' already exists.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const fromBranch = await this.getBranch(branchFromName);

		const body = {
			ref: `refs/heads/${newBranchName}`,
			sha: fromBranch.sha,
		};

		const url = `${this.baseUrl}/repos/${this.repoOwner}/${this.repoName}/git/refs`;
		const response = await this.fetchPOST(url, JSON.stringify(body));

		if (response.status != GitHubHttpStatusCodes.Created) {
			Utils.printAsGitHubError(`Error: ${response.status}(${response.statusText})`);
			Deno.exit(1);
		}
		
		const newRef = <IGitRef> await response.json();

		return {
			name: newRef.ref.replace("refs/heads/", ""),
			sha: newRef.object.sha,
		}
	}
}

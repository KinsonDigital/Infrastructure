import { GraphQLClient } from "../core/GraphQLClient.ts";
import { createGetBranchesQuery } from "../core/GraphQLQueries/GetBranchesQuery.ts";
import { Guard } from "../core/Guard.ts";
import { IPageInfoModel } from "../core/Models/GraphQLModels/IPageInfoModel.ts";
import { IGitBranchModel } from "../core/Models/GraphQLModels/IGitBranchModel.ts";
import { Utils } from "../core/Utils.ts";
import { RepoClient } from "./RepoClient.ts";
import { getCreateBranchMutation } from "../core/GraphQLMutations/CreateBranchMutation.ts";

/**
 * Provides a client for to perform git operations for a GitHub repository.
 */
export class GitClient extends GraphQLClient {
	private readonly repoOwner: string;
	private readonly repoName: string;
	private readonly repoClient: RepoClient;

	/**
	 * Initializes a new instance of the {@link GitClient} class.
	 * @param repoOwner The owner of the repository.
	 * @param repoName The name of the repository.
	 * @param token The GitHub token to use for authentication.
	 */
	constructor(repoOwner: string, repoName: string, token: string) {
		const funcName = "GitClient.Ctor";
		Guard.isNullOrEmptyOrUndefined(repoOwner, funcName, "repoOwner");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");

		super(token);

		this.repoOwner = repoOwner;
		this.repoName = repoName;
		this.repoClient = new RepoClient(token);
	}

	/**
	 * Gets a branch with the given branch {@link name}.
	 * @param name The name of the branch.
	 * @returns The branch.
	 */
	public async getBranch(name: string): Promise<IGitBranchModel> {
		Guard.isNullOrEmptyOrUndefined(name, "getBranch", "name");

		const branches: IGitBranchModel[] = await this.getBranches((branch) => branch.name === name);

		if (branches.length <= 0) {
			Utils.printAsGitHubError(`The branch '${name}' does not exist.`);
			Deno.exit(1);
		}

		return branches.filter((branch) => branch.name === name)[0];
	}

	/**
	 * Gets a list of branches for a repository.
	 * @param untilPredicate Used to determine when to stop getting branches.
	 * @returns The list of branches for the repository.
	 * @remarks If the {@link untilPredicate} is not provided, all branches will be returned.
	 */
	public async getBranches(untilPredicate?: (branch: IGitBranchModel) => boolean): Promise<IGitBranchModel[]> {
		const result: IGitBranchModel[] = [];
		let pageInfo: IPageInfoModel = { hasNextPage: true, hasPreviousPage: false };

		// As long as there is another page worth of information
		while (pageInfo.hasNextPage) {
			const cursor: string = Utils.isNullOrEmptyOrUndefined(pageInfo.endCursor) ? "" : <string> pageInfo.endCursor;

			const query: string = result.length <= 0
				? createGetBranchesQuery(this.repoOwner, this.repoName)
				: createGetBranchesQuery(this.repoOwner, this.repoName, 100, cursor);

			const responseData = await this.executeQuery(query);

			pageInfo = <IPageInfoModel> responseData.data.repository.refs.pageInfo;

			const branches = <IGitBranchModel[]> responseData.data.repository.refs.nodes.map((node: any) => {
				return {
					id: node.id,
					name: node.name,
					oid: node.target.oid,
				};
			});

			for (let i = 0; i < branches.length; i++) {
				const branch = branches[i];

				const stopPulling: boolean = untilPredicate != null &&
					untilPredicate != undefined &&
					untilPredicate(branch);

				result.push(branch);

				if (stopPulling) {
					return result;
				}
			}
		}

		return result;
	}

	/**
	 * Gets a value indicating whether or not a branch with the given branch {@link name} exists.
	 * @param name The name of the branch.
	 * @returns True if the branch exists; otherwise, false.
	 */
	public async branchExists(name: string): Promise<boolean> {
		Guard.isNullOrEmptyOrUndefined(name, "branchExists", "name");

		const branches: IGitBranchModel[] = await this.getBranches((branch) => branch.name === name);

		return branches.some((branch) => branch.name === name);
	}

	/**
	 * Creates a branch with the given {@link newBranchName} from a branch that matches the given {@link branchFromName}.
	 * @param newBranchName The name of the branch.
	 * @remarks Requires authentication.
	 */
	public async createBranch(newBranchName: string, branchFromName: string): Promise<IGitBranchModel> {
		const funcName = "createBranch";
		Guard.isNullOrEmptyOrUndefined(newBranchName, funcName, "newBranchName");
		Guard.isNullOrEmptyOrUndefined(branchFromName, funcName, "branchFromName");

		if (await this.branchExists(newBranchName)) {
			const errorMsg = `A branch with the name '${newBranchName}' already exists.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const fromBranch = await this.getBranch(branchFromName);

		const repo = await this.repoClient.getRepoByName(this.repoName);

		if (Utils.isNullOrEmptyOrUndefined(repo.node_id)) {
			const errorMsg = `The repository '${this.repoName}' did not return a required node ID.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const mutation: string = getCreateBranchMutation(repo.node_id, newBranchName, fromBranch.oid);

		const responseData = await this.executeQuery(mutation);
		const newBranch = responseData.data.createRef.ref;

		return {
			id: newBranch.id,
			name: newBranch.name,
			oid: newBranch.target.oid,
		};
	}
}

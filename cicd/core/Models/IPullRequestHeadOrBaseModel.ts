import { IRepoModel } from "./IRepoModel.ts";

/**
 * Holds information about a pull requests head or base branches.
 */
export interface IPullRequestHeadOrBaseModel {
	/**
	 * Gets or sets the ref.
	 */
	ref: string;

	/**
	 * Gets or sets the GIT sha.
	 */
	sha: string;

	/**
	 * Gets or sets the repository info.
	 */
	repo: IRepoModel;
}

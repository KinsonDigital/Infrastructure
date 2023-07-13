import { RepoVarModel } from "./RepoVarModel.ts";

/**
 * Represents multiple variables for a repository.
 */
export type RepoVariablesModel = { 
	/**
	 * Gets or sets the total number of variables for a repository.
	 */
	total_count: number;

	/**
	 * Gets or sets the list of variables for a repository.
	 */
	variables: RepoVarModel[];
}

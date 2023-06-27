import { IRepoVarModel } from "./IRepoVarModel.ts";

/**
 * Represents multiple variables for a repository.
 */
export interface IRepoVariablesModel {
	/**
	 * Gets or sets the total number of variables for a repository.
	 */
	total_count: number;

	/**
	 * Gets or sets the list of variables for a repository.
	 */
	variables: IRepoVarModel[];
}

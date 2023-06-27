import { IOrgVarModel } from "./IOrgVarModel.ts";

/**
 * Represents multiple variables for an organization.
 */
export interface IOrgVariablesModel {
	/**
	 * Gets or sets the total number of variables for an organization.
	 */
	total_count: number;

	/**
	 * Gets or sets the list of variables for an organization.
	 */
	variables: IOrgVarModel[];
}

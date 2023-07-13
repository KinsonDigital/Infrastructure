import { OrgVarModel } from "./OrgVarModel.ts";

/**
 * Represents multiple variables for an organization.
 */
export type OrgVariablesModel = {
	/**
	 * Gets or sets the total number of variables for an organization.
	 */
	total_count: number;

	/**
	 * Gets or sets the list of variables for an organization.
	 */
	variables: OrgVarModel[];
}

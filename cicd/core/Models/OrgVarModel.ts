/**
 * Represents a single organization variable.
 */
export type OrgVarModel = {
	/**
	 * Gets or sets the name of the variable.
	 */
	name: string;

	/**
	 * Gets or sets the value of the variable.
	 */
	value: string;

	/**
	 * Gets or sets the created date of the variable.
	 */
	created_at: string;

	/**
	 * Gets or sets the updated date of the variable.
	 */
	updated_at: string;

	/**
	 * Gets or sets the visibility of the variable.
	 */
	visibility: string;
};

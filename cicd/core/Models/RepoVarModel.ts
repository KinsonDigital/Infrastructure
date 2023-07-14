/**
 * Represents a single repository variable.
 */
export type RepoVarModel = {
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
};

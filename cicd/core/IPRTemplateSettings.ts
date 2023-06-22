/**
 * Represents the settings for a pull request template.
 */
export interface IPRTemplateSettings {
	/**
	 * Gets or sets the template path relative to the repository root of where it is contained.
	 */
	relativeTemplatePath: string;

	/**
	 * Gets or sets the issue number.
	*/
	issueNumber: number;

	/**
	 * Gets or sets the name of the head branch.
	 */
	headBranch: string;
	
	/**
	 * Gets or sets a value indicating whether or not the issue number is valid.
	 */
	issueNumValid: boolean;

	/**
	 * Gets or sets a value indicating whether or not the title is in sync.
	 */
	titleInSync: boolean;

	/**
	 * Gets or sets a value indicating whether or not the reviewer list has the default reviewer.
	 */
	defaultReviewerInSync: boolean;

	/**
	 * Gets or sets a value indicating whether or not the assignees are in sync.
	 */
	assigneesInSync: boolean;

	/**
	 * Gets or sets a value indicating whether or not the labels are in sync.
	 */
	labelsInSync: boolean;

	/**
	 * Gets or sets a value indicating whether or not the projects are in sync.
	 */
	projectsInSync: boolean;

	/**
	 * Gets or sets a value indicating whether or not the milestone is in sync.
	 */
	milestoneInSync: boolean;
}

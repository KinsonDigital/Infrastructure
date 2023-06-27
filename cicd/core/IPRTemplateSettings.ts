/**
 * Represents the settings for a pull request template.
 */
export interface IPRTemplateSettings {
	/**
	 * Gets or sets the issue number.
	 */
	issueNumber?: number;

	/**
	 * Gets or sets a value indicating whether or not the head branch is valid.
	 */
	headBranchValid?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the base branch is valid.
	 */
	baseBranchValid?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the issue number is valid.
	 */
	issueNumValid?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the title is in sync.
	 */
	titleInSync?: boolean;

	/**
	 * Gets or sets a value indicating whether or not one of the list of reviewers is the default reviewer.
	 */
	defaultReviewerValid?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the assignees are in sync.
	 */
	assigneesInSync?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the labels are in sync.
	 */
	labelsInSync?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the projects are in sync.
	 */
	projectsInSync?: boolean;

	/**
	 * Gets or sets a value indicating whether or not the milestone is in sync.
	 */
	milestoneInSync?: boolean;
}

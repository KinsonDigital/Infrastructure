/**
 * Represents that a GitHub issue was not found.
 */
export type IssueNotFound = {
	message: string;
};

/**
 * Represents that a GitHub pull request was not found.
 */
export type PullRequestNotFound = {
	message: string;
};

/**
 * Represents that a GitHub milestone was not found.
 */
export type MilestoneNotFound = {
	message: string;
};

/**
 * Represents a GitHub issue or pull request.
 */
export type ItemType = "issue" | "pull request";

/**
 * Represents that a GitHub issue was not found.
 */
export type IssueNotFound = {
    statusCode: number;
    statusText: string;
};

/**
 * Represents that a GitHub pull request was not found.
 */
export type PullRequestNotFound = {
    statusCode: number;
    statusText: string;
};

/**
 * Represents that a GitHub milestone was not found.
 */
export type MilestoneNotFound = {
    statusCode: number;
    statusText: string;
};

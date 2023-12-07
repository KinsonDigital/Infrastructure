import { IssueModel, PullRequestModel } from "../../deps.ts";

/**
 * Represents a GitHub issue or pull request.
 */
export type ItemType = "issue" | "pull-request";

/**
 * Represents a GitHub issue or pull request.
 */
export type IssueOrPR = IssueModel | PullRequestModel;

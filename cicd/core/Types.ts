import { IssueModel, PullRequestModel } from "../../deps.ts";

/**
 * Represents a GitHub issue or pull request.
 */
export type ItemType = "issue" | "pull-request";

/**
 * Represents a GitHub issue or pull request.
 */
export type IssueOrPR = IssueModel | PullRequestModel;

/**
 * Represents the type of project.
 */
export type ProjectType = "dotnet" | "deno";

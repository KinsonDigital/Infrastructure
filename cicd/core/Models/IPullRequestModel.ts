import { ILabelModel } from "./ILabelModel.ts";
import { IPullRequestHeadOrBaseModel } from "./IPullRequestHeadOrBaseModel.ts";
import { IPullRequestInfo } from "./IPullRequestInfo.ts";

/**
 * Represents a GitHub pull request.
 */
export interface IPullRequestModel {
	/**
	 * Gets or sets the ID of the pull request.
	 */
	id: number;

	/**
	 * Gets or sets the node id of the pull request.
	 */
	node_id?: string;

	/**
	 * Gets or sets the title of the pull request.
	 */
	title?: string;

	/**
	 * Gets or sets the number of the pull request.
	 */
	number: number;

	/**
	 * Gets or sets the labels of the pull request.
	 */
	labels?: ILabelModel[];

	/**
	 * Gets or sets the state of the pull request.
	 */
	state?: string;

	/**
	 * Gets or sets the URL to the pull request.
	 */
	url: string;

	/**
	 * Gets or sets the URL to the html page of the pull request.
	 */
	html_url?: string;

	/**
	 * Gets or sets if the pull request is a draft.
	 */
	draft?: boolean;

	/**
	 * Gets or sets additional information about the pull request.
	 */
	pull_request?: IPullRequestInfo;

	/**
	 * Gets or sets the head branch of the pull request.
	 */
	head: IPullRequestHeadOrBaseModel;

	/**
	 * Gets or sets the base branch of the pull request.
	 */
	base: IPullRequestHeadOrBaseModel;
}

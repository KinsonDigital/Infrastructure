import { ILabelModel } from "./ILabelModel.ts";

/**
 * Represents a GitHub issue.
 */
export interface IIssueModel {
	/**
	 * Gets or sets the title of the issue.
	 */
	title?: string;

	/**
	 * Gets or sets the number of the issue.
	 */
	number: number;

	/**
	 * Gets or sets the labels of the issue.
	 */
	labels?: ILabelModel[];

	/**
	 * Gets or sets the state of the issue.
	 */
	state?: string;

	/**
	 * Gets or sets the URL to the html page of the issue.
	 */
	html_url?: string;

	/**
	 * Gets or sets the node ID of the issue.
	 */
	node_id?: string;
}

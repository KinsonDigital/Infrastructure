/**
 * Represents a GitHub issue.
 */
export interface IIssueModel {
    /**
     * Gets or sets the title of the issue.
     */
    title: string;

    /**
     * Gets or sets the number of the issue.
     */
    number: number;

    /**
     * Gets or sets the labels of the issue.
     */
    labels: string[];

    /**
     * Gets or sets the state of the issue.
     */
    state: string;
}
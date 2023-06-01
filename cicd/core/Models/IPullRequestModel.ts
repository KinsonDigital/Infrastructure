/**
 * Represents a GitHub pull request.
 */
export interface IPullRequestModel {
    /**
     * Gets or sets the title of the pull request.
     */
    title: string;

    /**
     * Gets or sets the number of the pull request.
     */
    number: number;

    /**
     * Gets or sets the labels of the pull request.
     */
    labels: string[];

    /**
     * Gets or sets the state of the pull request.
     */
    state: string;

    /**
     * Gets or sets the URL to the html page of the pull request.
     */
    html_url: string;

    /**
     * Gets or sets if the pull request is a draft.
     */
    draft: boolean;
}

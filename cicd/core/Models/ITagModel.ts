import { ICommitModel } from "./ICommitModel.ts";

/**
 * Represents a GIT tag.
 */
export interface ITagModel {
    /**
     * Gets or sets the tag name.
     */
    name: string;

    /**
     * Gets or sets the zipball url.
     */
    zipball_url: string;

    /**
     * Gets or sets the tarball url.
     */
    tarball_url: string;

    /**
     * Gets or sets the commit.
     */
    commit: ICommitModel;

    /**
     * Gets or sets the node id.
     */
    node_id: string;
}

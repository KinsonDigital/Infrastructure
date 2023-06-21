import { IPageInfo } from "./IPageInfo.ts";

/**
 * Represents a response link header from a GitHub API response
 * that contains pagination information.
 */
export interface ILinkHeader {
	prevPage: number;

	nextPage: number;

	totalPages: number;

	pageData: IPageInfo[];
}

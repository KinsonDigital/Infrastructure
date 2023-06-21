import { decode } from "https://deno.land/std@0.192.0/encoding/base64.ts";
import { GitHubHttpStatusCodes } from "../core/Enums.ts";
import { GitHubClient } from "../core/GitHubClient.ts";
import { Guard } from "../core/Guard.ts";
import { IFileContentModel } from "../core/Models/IFileContentModel.ts";
import { IRepoModel } from "../core/Models/IRepoModel.ts";
import { Utils } from "../core/Utils.ts";

/**
 * Provides a client for interacting with GitHub repositories.
 */
export class RepoClient extends GitHubClient {
	private readonly newLineBase64 = btoa("\n");

	/**
	 * Initializes a new instance of the {@link RepoClient} class.
	 * @param token The GitHub token to use for authentication.
	 */
	constructor(token?: string) {
		super(token);
	}

	/**
	 * Gets a repository with the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @returns A repository.
	 */
	public async getRepoByName(repoName: string): Promise<IRepoModel> {
		Guard.isNullOrEmptyOrUndefined(repoName, "getRepoByName", "repoName");

		repoName = repoName.trim();

		const foundRepos = await this.getAllDataUntil<IRepoModel>(
			async (page, qtyPerPage) => {
				return await this.getRepos(page, qtyPerPage ?? 100);
			},
			1, // Start page
			100, // Qty per page
			(pageOfData: IRepoModel[]) => {
				return pageOfData.some((repo) => repo.name.trim() === repoName);
			},
		);

		const foundRepo: IRepoModel | undefined = foundRepos.find((repo) => repo.name.trim() === repoName);

		if (foundRepo === undefined) {
			Utils.printAsGitHubError(`The repository '${repoName}' was not found.`);
			Deno.exit(1);
		}

		return foundRepo;
	}

	/**
	 * Gets a {@link page} of repositories with the {@link qtyPerPage}.
	 * @param page The page number of the results to get.
	 * @param qtyPerPage The quantity of results to get per page.
	 * @returns A list of repositories.
	 * @remarks The {@link page} value must be greater than 0. If less than 1, the value of 1 will be used.
	 * The {@link qtyPerPage} value must be a value between 1 and 100. If less than 1, the value will
	 * be set to 1, if greater than 100, the value will be set to 100.
	 */
	public async getRepos(page: number, qtyPerPage: number): Promise<[IRepoModel[], Response]> {
		page = page < 1 ? 1 : page;
		qtyPerPage = Utils.clamp(qtyPerPage, 1, 100);

		const queryParams = `?page=${page}&per_page=${qtyPerPage}`;
		const url = `${this.baseUrl}/${this.organization}/repos${queryParams}`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status === GitHubHttpStatusCodes.NotFound) {
			const errorMsg = `Not found. Check that the repository owner '${this.organization}' is a valid repository owner.`;
			Utils.printAsGitHubError(errorMsg);

			Deno.exit(1);
		}

		return [<IRepoModel[]> await this.getResponseData(response), response];
	}

	/**
	 * Checks if a repo exists.
	 * @param repoName The name of the repo to check.
	 * @returns True if the repo exists; otherwise, false.
	 */
	public async repoExists(repoName: string): Promise<boolean> {
		Guard.isNullOrEmptyOrUndefined(repoName, "repoExists", "repoName");

		repoName = repoName.trim();

		const url = `${this.baseUrl}/${this.organization}/${repoName}`;

		const response: Response = await this.fetchGET(url);

		// If there is an error
		if (response.status === GitHubHttpStatusCodes.NotFound) {
			return false;
		}

		switch (response.status) {
			case GitHubHttpStatusCodes.MovedPermanently:
			case GitHubHttpStatusCodes.Forbidden: {
				const errorMsg = `Error: ${response.status} (${response.statusText})`;
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		}

		return true;
	}

	/**
	 * Gets the content of a file at the given {@link relativeFilePath} in a repository with a name
	 * that matches the given {@link repoName}.
	 * @param repoName The name of the repository to check.
	 * @param relativeFilePath The relative path of the file.
	 * @returns The content of the file.
	 * @remarks The {@link relativeFilePath} is relative to the root of the repository.
	 */
	public async getFileContent(repoName: string, relativeFilePath: string): Promise<string> {
		const funcName = "getFileContent";
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");
		Guard.isNullOrEmptyOrUndefined(relativeFilePath, funcName, "relativeFilePath");

		relativeFilePath = relativeFilePath.trim();
		relativeFilePath = relativeFilePath.startsWith("/") ? relativeFilePath : `/${relativeFilePath}`;

		const url = `https://api.github.com/repos/${this.organization}/${repoName}/contents${relativeFilePath}`;

		const response: Response = await this.fetchGET(url);

		switch (response.status) {
			case GitHubHttpStatusCodes.NotFound:
			case GitHubHttpStatusCodes.TemporaryRedirect:
			case GitHubHttpStatusCodes.Forbidden:
				Utils.printAsGitHubError(`Error: ${response.status} (${response.statusText})`);
				Deno.exit(1);
		}

		const responseData = <IFileContentModel> await this.getResponseData(response);

		// Replace all plain text new line character strings with actual new line characters
		const content = responseData.content.replace(/\\n/g, this.newLineBase64);

		// Return the file content after it has been decoded from base64
		return new TextDecoder().decode(decode(content));
	}

	/**
	 * Gets a value indicating whether or not a file exists with the given {@link relativeFilePath}
	 * in a repository with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository to check.
	 * @param relativeFilePath The relative path of the file.
	 * @returns True if the file exists; otherwise, false.
	 * @remarks The {@link relativeFilePath} is relative to the root of the repository.
	 */
	public async fileExists(repoName: string, relativeFilePath: string): Promise<boolean> {
		const funcName = "fileExists";
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");
		Guard.isNullOrEmptyOrUndefined(relativeFilePath, funcName, "relativeFilePath");

		relativeFilePath = relativeFilePath.trim();
		relativeFilePath = relativeFilePath.startsWith("/") ? relativeFilePath : `/${relativeFilePath}`;

		const url = `https://api.github.com/repos/${this.organization}/${repoName}/contents${relativeFilePath}`;

		const response: Response = await this.fetchGET(url);

		if (response.status === GitHubHttpStatusCodes.NotFound) {
			return false;
		}

		return true;
	}
}

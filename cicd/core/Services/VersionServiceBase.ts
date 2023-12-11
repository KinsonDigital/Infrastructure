import { RepoClient } from "../../../deps.ts";
import { ReleaseType } from "../Enums.ts";
import { Utils } from "../Utils.ts";
import { GitHubVariableService } from "./GitHubVariableService.ts";

/**
 * Performs updates to version files.
 */
export abstract class VersionServiceBase {
	private static readonly PREV_PREP_RELEASE_HEAD_BRANCH = "PREV_PREP_RELEASE_HEAD_BRANCH";
	private static readonly PROD_PREP_RELEASE_HEAD_BRANCH = "PROD_PREP_RELEASE_HEAD_BRANCH";
	private static readonly PREP_PROJ_RELATIVE_FILE_PATH = "PREP_PROJ_RELATIVE_FILE_PATH";
	private readonly githubVarService: GitHubVariableService;
	private readonly ownerName: string;
	private readonly repoName: string;
	private readonly token: string;
	protected readonly repoClient: RepoClient;
	private relativeProjFilePath = "";
	private branchName = "";

	/**
	 * Initializes a new instance of the {@link VersionServiceBase} class.
	 * @param ownerName The name of the GitHub repository owner.
	 * @param repoName The name of the GitHub repository.
	 * @param token The GitHub personal access token.
	 */
	constructor(ownerName: string, repoName: string, token: string) {
		this.repoClient = new RepoClient(ownerName, repoName, token);
		this.githubVarService = new GitHubVariableService(ownerName, repoName, token);

		this.ownerName = ownerName;
		this.repoName = repoName;
		this.token = token;

		this.checkThatAllVarsExist();
	}

	/**
	 * Updates the version of the version file to the given {@link version}.
	 * @param version The version to update to.
	 * @param releaseType The type of release.
	 */
	public abstract updateVersion(version: string, releaseType: ReleaseType): Promise<void>;

	/**
	 * Checks if the given {@link version} is a valid preview or production version.
	 * @param version The version to check.
	 */
	public abstract versionIsValid(version: string): boolean;

	/**
	 * Checks if the given {@link fileData} contains a valid version schema.
	 * @param fileData The file data to check.
	 */
	public abstract fileContainsVersionSchema(fileData: string): boolean;
	
	/**
	 * Checks if the given {@link fileData} already has the given {@link version}.
	 * @param fileData The file data to check.
	 * @param version The version to check.
	 */
	public abstract versionAlreadyUpdated(fileData: string, version: string): boolean;

	/**
	 * Gets the file data of the version file.
	 * @param releaseType The type of release.
	 * @returns The file data of the version file.
	 */
	public async getFileData(releaseType: ReleaseType): Promise<string> {
		const repoClient = new RepoClient(this.ownerName, this.repoName, this.token);

		const branchName = await this.getHeadBranchName(releaseType);

		const relativeProjFilePath = await this.getVersionFilePath();

		if (!(await repoClient.fileExists(branchName, relativeProjFilePath))) {
			let errorMsg = `The version file '${relativeProjFilePath}' does not exist on the branch '${branchName}' `;
			errorMsg += "or the branch does not exist.";
			errorMsg += "\nPlease make sure the branch and version file exist and try again.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		return await this.repoClient.getFileContent(branchName, relativeProjFilePath);
	}

	/**
	 * Updates the version file with the given {@link updatedFileData}.
	 * @param updatedFileData The updated file data.
	 * @param version The version to update to.
	 * @param releaseType The type of release.
	 */
	public async updateFileData(updatedFileData: string, version: string, releaseType: ReleaseType): Promise<void> {
		const branchName = await this.getHeadBranchName(releaseType);
		const relativeProjFilePath = await this.getVersionFilePath();

		await this.repoClient.updateFile(
			branchName,
			relativeProjFilePath,
			updatedFileData,
			`release: updated version to v${version}`,
		);
	}

	/**
	 * Gets the name of the version file.
	 * @returns The name of the version file.
	 */
	protected async getVersionFilePath(): Promise<string> {
		// If the value has not been pulled yet, cache it
		if (Utils.isNothing(this.relativeProjFilePath)) {
			let path = await this.githubVarService.getValue(VersionServiceBase.PREP_PROJ_RELATIVE_FILE_PATH, false);

			path = path.trim();
			path = Utils.normalizePath(path);
			path = Utils.trimAllStartingValue(path, "/");

			this.relativeProjFilePath = path;
		}

		return this.relativeProjFilePath;
	}

	/**
	 * Gets the name of the head branch for a release that matches the given {@link releaseType}.
	 * @param releaseType The type of release.
	 * @returns The name of the head branch for the release.
	 */
	private async getHeadBranchName(releaseType: ReleaseType): Promise<string> {
		// If the branch name has not been set yet, cache it
		if (Utils.isNothing(this.branchName)) {
			let branchVarName = "";
			
			switch (releaseType) {
				case ReleaseType.preview:
					branchVarName = VersionServiceBase.PREV_PREP_RELEASE_HEAD_BRANCH;
					break;
				case ReleaseType.production:
					branchVarName = VersionServiceBase.PROD_PREP_RELEASE_HEAD_BRANCH;
					break;
				default:
					Utils.printAsGitHubError(`Unknown release type '${releaseType}'.`);
					Deno.exit(1);
			}
			
			const branchName = await this.githubVarService.getValue(branchVarName);
			this.branchName = branchName;
		}

		return this.branchName;
	}

	/**
	 * Checks that all of the required variables exist, and if not, prints out the missing variables and exists.
	 */
	private async checkThatAllVarsExist(): Promise<void> {
		const requiredVars = this.getRequiredVars();

		// Check if all of the required org and/or repo variables exist
		const [orgRepoVarExist, missingVars] = await this.githubVarService.allVarsExist(requiredVars);

		if (!orgRepoVarExist) {
			const missingVarErrors: string[] = [];

			for (let i = 0; i < missingVars.length; i++) {
				const missingVarName = missingVars[i];

				missingVarErrors.push(`The required org/repo variable '${missingVarName}' is missing.`);
			}

			Utils.printAsGitHubErrors(missingVarErrors);
			Deno.exit(1);
		}
	}

	/**
	 * Gets the list of required variables.
	 * @returns The is of the required variables.
	 */
	private getRequiredVars(): string[] {
		return [
			VersionServiceBase.PREP_PROJ_RELATIVE_FILE_PATH,
			VersionServiceBase.PREV_PREP_RELEASE_HEAD_BRANCH,
			VersionServiceBase.PROD_PREP_RELEASE_HEAD_BRANCH,
		]
	}
}

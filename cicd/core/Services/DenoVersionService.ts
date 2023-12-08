import { ReleaseType } from "../Enums.ts";
import { Guard } from "../Guard.ts";
import { Utils } from "../Utils.ts";
import { VersionServiceBase } from "./VersionServiceBase.ts";

/**
 * Updates the version of a deno config file directly on a branch of a repository.
 */
export class DenoVersionService extends VersionServiceBase {
	private readonly versionRegex = /^\s*v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?\s*$/gm;
	private readonly versionKeyRegex = /"version":\s*".+?"/gm;

	/**
	 * Initializes a new instance of the {@link CSharpVersionService} class.
	 * @param ownerName The name of the GitHub repository owner.
	 * @param repoName The name of the GitHub repository.
	 * @param token The GitHub personal access token.
	 */
	constructor(ownerName: string, repoName: string, token: string) {
		super(ownerName, repoName, token);
	}

	/**
	 * @inheritdoc
	 */
	public async updateVersion(version: string, releaseType: ReleaseType): Promise<void> {
		Guard.isNothing(version, "updateVersion", "version");

		version = version.trim().toLowerCase();

		// Add the letter 'v' if it exists
		version = version.startsWith("v") ? version : `v${version}`;

		if (!this.versionIsValid(version)) {
			let errorMsg = `The version '${version}' is not a valid preview or production version.`;
			errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}
		
		
		let denoConfigFileData = await this.getFileData(releaseType);
		const denoConfigFileName = await this.getVersionFileName();
		
		if (!this.fileContainsVersionSchema(denoConfigFileData)) {
			let errorMsg = `The file '${denoConfigFileName}' does not contain or has too many 'version' JSON keys.`;
			errorMsg += "\nPlease add a single version key and value with the following syntax: \"version\": \"v#.#.#[-preview.#]\"";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		if (this.versionAlreadyUpdated(denoConfigFileData, version)) {
			let errorMsg = `The version '${version}' is already set for the version key in the file '${denoConfigFileName}'.`;
			errorMsg += "\nPlease use a different version.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const newVersionKeyAndValue = `"version": "${version}"`;

		// Replace the version key and value with the new key and value
		denoConfigFileData = denoConfigFileData.replace(this.versionKeyRegex, newVersionKeyAndValue);

		await this.updateFileData(denoConfigFileData, version, releaseType);
	}

	/**
	 * @inheritdoc
	 */
	public versionIsValid(version: string): boolean {
		// TODO: check to make sure that a version key does not exist more than once
		return this.versionRegex.test(version);
	}

	/**
	 * @inheritdoc
	 */
	public fileContainsVersionSchema(fileData: string): boolean {
		const matches = fileData.match(this.versionKeyRegex) ?? [];

		return matches.length === 1;
	}

	/**
	 * @inheritdoc
	 */
	public versionAlreadyUpdated(fileData: string, version: string): boolean {
		const jsonKeyAndValue = fileData.match(this.versionKeyRegex)?.[0] ?? "";
		const jsonValue = jsonKeyAndValue?.match(this.versionRegex)?.[0] ?? "";

		return jsonValue === version;
	}
}

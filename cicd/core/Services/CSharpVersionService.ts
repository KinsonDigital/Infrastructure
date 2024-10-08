import { Guard } from "../Guard.ts";
import { VersionServiceBase } from "./VersionServiceBase.ts";
import { Utils } from "../Utils.ts";
import { ReleaseType } from "../Enums.ts";

/**
 * Updates the version of a C# project file directly on a branch of a repository.
 */
export class CSharpVersionService extends VersionServiceBase {
	private readonly versionTagRegex = /<Version\s*>.*<\/Version\s*>/gm;
	private readonly fileVersionTagRegex = /<FileVersion\s*>.*<\/FileVersion\s*>/gm;

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
	 * Updates the version values of a C# project file to the given {@link version}.
	 */
	public async updateVersion(version: string, releaseType: ReleaseType): Promise<void> {
		Guard.isNothing(version, "updateVersion", "version");

		version = version.trim().toLowerCase();

		// Remove the letter 'v' if it exists
		version = version.startsWith("v") ? version.substring(1) : version;

		if (!this.versionIsValid(version)) {
			let errorMsg = `The version '${version}' is not a valid preview or production version.`;
			errorMsg += "\nRequired Syntax: #.#.# or v#.#.#-preview.#";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		let csprojFileData = await this.getFileData(releaseType);
		const csprojFileName = await this.getVersionFilePath();

		if (!this.fileContainsVersionSchema(csprojFileData)) {
			let errorMsg = `The file '${csprojFileName}' does not contain a '<Version/>' tag.`;
			errorMsg += "\nPlease add a version tag with the following syntax: <Version></Version>";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		if (this.versionAlreadyUpdated(csprojFileData, version)) {
			const errorMsg = `The version '${version}' is already set for the '<Version/>' and/or '<FileVersion/>' tags in the` +
				` file '${csprojFileName}'.` +
				"\nPlease use a different version.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const newVersionTag = `<Version>${version}</Version>`;
		const newFileVersionTag = `<FileVersion>${version}</FileVersion>`;

		// Replace the version tags with the new tags
		csprojFileData = csprojFileData.replace(this.versionTagRegex, newVersionTag);
		csprojFileData = csprojFileData.replace(this.fileVersionTagRegex, newFileVersionTag);

		await this.updateFileData(csprojFileData, version, releaseType);
	}

	/**
	 * @inheritdoc
	 */
	public versionIsValid(version: string): boolean {
		return Utils.isValidPreviewVersion(version) && Utils.isValidProdVersion(version);
	}

	/**
	 * @inheritdoc
	 */
	public fileContainsVersionSchema(fileData: string): boolean {
		return this.versionTagRegex.test(fileData) && this.fileVersionTagRegex.test(fileData);
	}

	/**
	 * @inheritdoc
	 */
	public versionAlreadyUpdated(fileData: string, version: string): boolean {
		return this.versionTagValueAlreadyUpdated(fileData, version) && this.fileVersionTagValueAlreadyUpdated(fileData, version);
	}

	/**
	 * Checks if the given {@link fileData} already has the '<Version/>' tag value already updated to the given {@link version}.
	 * @param fileData The file data to check.
	 * @param version The new version.
	 * @returns True if the tag value is already updated to the new version; otherwise, false.
	 */
	private versionTagValueAlreadyUpdated(fileData: string, version: string): boolean {
		const versionTag = fileData.match(this.versionTagRegex)?.[0] ?? "";

		// Get the version value from the version tag
		const versionTagValue = versionTag.replaceAll("Version", "")
			.replaceAll("<", "")
			.replaceAll(">", "")
			.replaceAll("/", "")
			.trim().toLowerCase();

		// If the tag value matches the new version
		return versionTagValue === version;
	}

	/**
	 * Checks if the given {@link fileData} already has the '<FileVersion/>' tag value already updated to the given {@link version}.
	 * @param fileData The file data to check.
	 * @param version The new version.
	 * @returns True if the tag value is already updated to the new version; otherwise, false.
	 */
	private fileVersionTagValueAlreadyUpdated(fileData: string, version: string): boolean {
		const versionTag = fileData.match(this.fileVersionTagRegex)?.[0] ?? "";

		// Get the version value from the version tag
		const versionTagValue = versionTag.replaceAll("Version", "")
			.replaceAll("<", "")
			.replaceAll(">", "")
			.replaceAll("/", "")
			.trim().toLowerCase();

		// If the tag value matches the new version
		return versionTagValue === version;
	}
}

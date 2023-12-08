import { Guard } from "../Guard.ts";
import { VersionServiceBase } from "./VersionServiceBase.ts";
import { Utils } from "../Utils.ts";
import { ReleaseType } from "../Enums.ts";

/**
 * Updates the version of a C# project file directly on a branch of a repository.
 */
export class CSharpVersionService extends VersionServiceBase {
	private readonly versionRegex = /[1-9][0-9]*\.[1-9][0-9]*\.[1-9][0-9]*(|-preview.[0-9]*)/gm;
	private readonly versionTagRegex = /<Version>[1-9][0-9]*\.[1-9][0-9]*\.[1-9][0-9]*(|-preview.[1-9][0-9]*)<\/Version>/gm;
	private readonly fileVersionTagRegex = /<FileVersion>[1-9][0-9]*\.[1-9][0-9]*\.[0-9]*(|-preview.[1-9][0-9]*)<\/FileVersion>/gm;

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
		const csprojFileName = await this.getVersionFileName();

		if (!this.fileContainsVersionSchema(csprojFileData)) {
			let errorMsg = `The file '${csprojFileName}' does not contain a '<Version/>' tag.`;
			errorMsg += "\nPlease add a version tag with the following syntax: <Version></Version>";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		if (this.versionAlreadyUpdated(csprojFileData, version)) {
			let errorMsg = `The version '${version}' is already set for the version tag in the file '${csprojFileName}'.`;
			errorMsg += "\nPlease use a different version.";
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
		return this.versionRegex.test(version);
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
		const versionTag = fileData.match(this.versionTagRegex)?.[0] ?? "";

		// Get the version value from the version tag
		const versionTagValue = versionTag.replace("<Version>", "").replace("</Version>", "");

		// If the tag value matches the new version
		return versionTagValue === version;
	}
}

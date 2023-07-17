import { File } from "../File.ts";
import { Utils } from "../Utils.ts";

/**
 * Performs updates to csharp versions in csharp project files.
 */
export class CSharpVersionService {
	private readonly versionRegex = /[0-9]+\.[0-9]+\.[0-9]+(|-preview.[0-9]+)/gm;
	private readonly versionTagRegex = /<Version>[0-9]+\.[0-9]+\.[0-9]+(|-preview.[0-9]+)<\/Version>/gm;
	private readonly fileVersionTagRegex = /<FileVersion>[0-9]+\.[0-9]+\.[0-9]+(|-preview.[0-9]+)<\/FileVersion>/gm;

	public updateVersion(projFilePath: string, version: string): void {
		projFilePath = Utils.normalizePath(projFilePath);
		version = version.trim().toLowerCase();

		// Remove the letter 'v' if it exists
		version = version.startsWith("v") ? version.slice(1) : version;

		if (File.DoesNotExist(projFilePath)) {
			Utils.printAsGitHubError(`The file '${projFilePath}' does not exist.`);
			Deno.exit(1);
		}

		if (!this.versionRegex.test(version)) {
			let errorMsg = `The version '${version}' is not a valid preview or production version.`;
			errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		let projFile = File.LoadFile(projFilePath);

		if (!this.versionTagRegex.test(projFile)) {
			let errorMsg = `The file '${projFilePath}' does not contain a <Version/> tag.`;
			errorMsg += "\nPlease add a version tag with the following syntax: <Version></Version>";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		if (!this.fileVersionTagRegex.test(projFile)) {
			let errorMsg = `The file '${projFilePath}' does not contain a <FileVersion/> tag.`;
			errorMsg += "\nPlease add a file version tag with the following syntax: <FileVersion></FileVersion>";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const versionTag = projFile.match(this.versionTagRegex)![0];

		// Get the version value from the version tag
		const versionTagValue = versionTag.replace("<Version>", "").replace("</Version>", "");

		// If the tag value matches the new version 
		if (versionTagValue === version) {
			let errorMsg = `The version '${version}' is already set for the version tag in the file '${projFilePath}'.`;
			errorMsg += "\nPlease use a different version.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const fileVersionTag = projFile.match(this.fileVersionTagRegex)![0];

		// Get the file version value from the file version tag
		const fileVersionTagValue = fileVersionTag.replace("<FileVersion>", "").replace("</FileVersion>", "");

		// If the file tag version matches the new version
		if (fileVersionTagValue === version) {
			let errorMsg = `The version '${version}' is already set for the file version tag in the file '${projFilePath}'.`;
			errorMsg += "\nPlease use a different version.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const newVersionTag = `<Version>${version}</Version>`;
		const newFileVersionTag = `<FileVersion>${version}</FileVersion>`;

		// Replace the version tags with the new tags
		projFile = projFile.replace(this.versionTagRegex, newVersionTag);
		projFile = projFile.replace(this.fileVersionTagRegex, newFileVersionTag);

		// Save the updates to the file
		File.SaveFile(projFilePath, projFile);
	}
}

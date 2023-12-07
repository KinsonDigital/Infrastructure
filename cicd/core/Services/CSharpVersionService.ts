import { RepoClient } from "../../../deps.ts";
import { Guard } from "../Guard.ts";
import { Utils } from "../Utils.ts";

/**
 * Performs updates to csharp versions in csharp project files.
 */
export class CSharpVersionService {
	private readonly versionRegex = /[0-9]+\.[0-9]+\.[0-9]+(|-preview.[0-9]+)/gm;
	private readonly versionTagRegex = /<Version>[0-9]+\.[0-9]+\.[0-9]+(|-preview.[0-9]+)<\/Version>/gm;
	private readonly fileVersionTagRegex = /<FileVersion>[0-9]+\.[0-9]+\.[0-9]+(|-preview.[0-9]+)<\/FileVersion>/gm;
	private readonly ownerName: string;
	private readonly repoName: string;
	private readonly token: string;

	/**
	 * Initializes a new instance of the {@link CSharpVersionService} class.
	 * @param ownerName The name of the GitHub repository owner.
	 * @param repoName The name of the GitHub repository.
	 * @param token The GitHub personal access token.
	 */
	constructor(ownerName: string, repoName: string, token: string) {
		const funcName = "CSharpVersionService.ctor";
		Guard.isNothing(ownerName, funcName, "ownerName");
		Guard.isNothing(repoName, funcName, "repoName");

		this.ownerName = ownerName;
		this.repoName = repoName;
		this.token = token;
	}

	/**
	 * Updates the version tags to the given {@link version} in a csharp project file, on a branch with the
	 * given {@link branchName}, at the given {@link relativeProjFilePath}.
	 * @param branchName The name of the branch where the file exists.
	 * @param relativeProjFilePath The fully qualified file path to the project file.
	 * @param version The version to update the project file to.
	 */
	public async updateVersion(branchName: string, relativeProjFilePath: string, version: string): Promise<void> {
		const funcName = "updateVersion";
		Guard.isNothing(branchName, funcName, "branchName");
		Guard.isNothing(relativeProjFilePath, funcName, "projFilePath");
		Guard.isNothing(version, funcName, "version");

		relativeProjFilePath = Utils.normalizePath(relativeProjFilePath);
		version = version.trim().toLowerCase();

		// Remove the letter 'v' if it exists
		version = version.startsWith("v") ? version.slice(1) : version;

		if (!this.versionRegex.test(version)) {
			let errorMsg = `The version '${version}' is not a valid preview or production version.`;
			errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const repoClient = new RepoClient(this.ownerName, this.repoName, this.token);

		if (!(await repoClient.fileExists(branchName, relativeProjFilePath))) {
			let errorMsg = `The csproj file '${relativeProjFilePath}' does not exist on the branch '${branchName}'.`;
			errorMsg += "\nPlease create the file and try again.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		let projFileData = await repoClient.getFileContent(branchName, relativeProjFilePath);

		if (!this.versionTagRegex.test(projFileData)) {
			let errorMsg = `The file '${relativeProjFilePath}' does not contain a <Version/> tag.`;
			errorMsg += "\nPlease add a version tag with the following syntax: <Version></Version>";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		if (!this.fileVersionTagRegex.test(projFileData)) {
			let errorMsg = `The file '${relativeProjFilePath}' does not contain a <FileVersion/> tag.`;
			errorMsg += "\nPlease add a file version tag with the following syntax: <FileVersion></FileVersion>";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const versionTag = projFileData.match(this.versionTagRegex)![0];

		// Get the version value from the version tag
		const versionTagValue = versionTag.replace("<Version>", "").replace("</Version>", "");

		// If the tag value matches the new version
		if (versionTagValue === version) {
			let errorMsg = `The version '${version}' is already set for the version tag in the file '${relativeProjFilePath}'.`;
			errorMsg += "\nPlease use a different version.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const fileVersionTag = projFileData.match(this.fileVersionTagRegex)![0];

		// Get the file version value from the file version tag
		const fileVersionTagValue = fileVersionTag.replace("<FileVersion>", "").replace("</FileVersion>", "");

		// If the file tag version matches the new version
		if (fileVersionTagValue === version) {
			let errorMsg = `The version '${version}' is already set for the file version tag in the file`;
			errorMsg += "\n '${relativeProjFilePath}'. Please use a different version.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const newVersionTag = `<Version>${version}</Version>`;
		const newFileVersionTag = `<FileVersion>${version}</FileVersion>`;

		// Replace the version tags with the new tags
		projFileData = projFileData.replace(this.versionTagRegex, newVersionTag);
		projFileData = projFileData.replace(this.fileVersionTagRegex, newFileVersionTag);

		await repoClient.updateFile(
			branchName,
			relativeProjFilePath,
			projFileData,
			`release: updated version to v${version}`,
		);
	}
}

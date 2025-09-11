import { walkSync } from "../../../deps.ts";
import { Guard } from "../Guard.ts";
import { Utils } from "../Utils.ts";

/**
 * Validates that a dotnet SDK setup for al dotnet projects are correct.
 */
export class ValidateSDKVersionService {
	private readonly targetFrameworkRegex = /<TargetFramework\s*>\s*net.+\s*<\/TargetFramework\s*>/gm;
	private readonly dotnetSDKVersionRegex = /^([1-9]\d*|0)(\.([1-9]\d*|0)|)(\.([1-9]\d*|0)|)$/gm;
	private readonly csprojTargetFrameworkVersionRegex = /net([1-9]\d*|0)(\.([1-9]\d*|0)|)(\.([1-9]\d*|0)|)/gm;

	/**
	 * Validates the given {@link expectedSdkVersion} against all of the csproj files in the current directory.
	 * @param searchBaseDirPath The base directory path to search for csproj files.
	 * @param expectedSdkVersion The version to validate.
	 * @remarks If any of the csproj file SDK version do not match, the workflow will fail.
	 */
	public validate(searchBaseDirPath: string, expectedSdkVersion: string): void {
		Guard.isNothing(expectedSdkVersion, "validate");

		expectedSdkVersion = expectedSdkVersion.trim().toLowerCase();
		expectedSdkVersion = expectedSdkVersion.startsWith("v") ? expectedSdkVersion.substring(1) : expectedSdkVersion;

		let sections = expectedSdkVersion.split(".");

		if (sections.length >= 3) {
			sections = [sections[0], sections[1]];
		}

		// Remove any x's from the version string
		expectedSdkVersion = sections.filter((s) => s != "x").join(".");

		if (!this.dotnetSDKVersionRegex.test(expectedSdkVersion.trim().toLowerCase())) {
			Utils.printAsGitHubError(`The NET_SDK_VERSION variable is not a valid dotnet version: ${expectedSdkVersion}`);
			Deno.exit(1);
		}

		// Find all of the csproj files for inspection
		const csprojEntries = walkSync(searchBaseDirPath, {
			includeDirs: false,
			includeFiles: true,
			exts: [".csproj"],
		});

		const csProFiles = [...csprojEntries].map((entry) => entry.path.replaceAll("\\", "/"))
			.filter((path) => !/(\/bin\/|\/obj\/)/.test(path));

		const filesWithoutTargetFramework: string[] = [];
		const nonMatchingVersions: [string, string][] = [];

		for (const csProjFile of csProFiles) {
			const fileData = Deno.readTextFileSync(csProjFile);

			let currentSdkVersion = "";

			// If the target framework XML exists, check the version value.
			if (this.targetFrameworkRegex.test(fileData)) {
				try {
					currentSdkVersion = this.getCSProjTargetFrameworkVersion(fileData).replace("net", "");
				} catch (error) {
					const errMsg = error instanceof Error
						? error.message
						: "An error occurred getting the csproj target framework version.";
					nonMatchingVersions.push([csProjFile, errMsg]);
				}

				const versionsMatch = expectedSdkVersion === currentSdkVersion;

				if (versionsMatch) {
					continue;
				}

				const errorMsg =
					`The current target framework version '${currentSdkVersion}' in the csproj file '${csProjFile}' does not match the expected` +
					` version of '${expectedSdkVersion}'.  Please check the 'NET_SDK_VERSION' repository variable.`;
				nonMatchingVersions.push([csProjFile, errorMsg]);
			} else {
				filesWithoutTargetFramework.push(csProjFile);
			}
		}

		// If there are any issues with any of the files, print them out.
		if (filesWithoutTargetFramework.length > 0 || nonMatchingVersions.length > 0) {
			filesWithoutTargetFramework.forEach((fileWithout) => {
				Utils.printAsGitHubError(`The file '${fileWithout}' does not have a target framework defined.`);
			});

			nonMatchingVersions.forEach((nonMatchingVersion) => {
				const errorMsg = `The file '${nonMatchingVersion[0]}' has a target framework version that does not ` +
					`match the NET_SDK_VERSION variable.\n${nonMatchingVersion[1]}`;
				Utils.printAsGitHubError(errorMsg);
			});

			Deno.exit(1);
		}
	}

	/**
	 * Gets the first occurrence of a dotnet target framework version found in the given {@link csProjFileData}.
	 * @param csProjFileData The csproj file data that might contain the target framework version.
	 * @returns The dotnet SDK version.
	 */
	public getCSProjTargetFrameworkVersion(csProjFileData: string): string {
		const tagMatches = csProjFileData.match(this.targetFrameworkRegex);

		const targetFrameworkTags = tagMatches === null || tagMatches.length === 0 ? [] : [...tagMatches];

		if (targetFrameworkTags.length === 0) {
			throw new Error("Could not find any target framework XML tags in the given csproj file data.");
		}

		const matches: string[] = targetFrameworkTags[0].match(this.csprojTargetFrameworkVersionRegex) ?? [];

		return matches.length > 0 ? matches[0] : "";
	}
}

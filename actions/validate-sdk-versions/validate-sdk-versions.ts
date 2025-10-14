import { walkSync } from "jsr:@std/fs@1.0.19";
import { getEnvVar, isNothing } from "../../cicd/core/Utils.ts";
import { printAsGitHubError } from "../../cicd/core/github.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const baseSearchDirPath = getEnvVar("BASE_SEARCH_DIR_PATH", scriptFileName);
let dotnetSdkVersion = getEnvVar("NET_SDK_VERSION", scriptFileName);
const targetFrameworkRegex = /<TargetFramework\s*>\s*net.+\s*<\/TargetFramework\s*>/gm;
const dotnetSDKVersionRegex = /^([1-9]\d*|0)(\.([1-9]\d*|0)|)(\.([1-9]\d*|0)|)$/gm;
const csprojTargetFrameworkVersionRegex = /net([1-9]\d*|0)(\.([1-9]\d*|0)|)(\.([1-9]\d*|0)|)/gm;

if (isNothing(baseSearchDirPath)) {
	printAsGitHubError("The baseSearchDirPath parameter cannot be null, undefined, or empty.");
	Deno.exit(1);
}

if (isNothing(dotnetSdkVersion)) {
	printAsGitHubError("The dotnetSdkVersion parameter cannot be null, undefined, or empty.");
	Deno.exit(1);
}

dotnetSdkVersion = dotnetSdkVersion.trim().toLowerCase();
dotnetSdkVersion = dotnetSdkVersion.startsWith("v") ? dotnetSdkVersion.substring(1) : dotnetSdkVersion;

let sections = dotnetSdkVersion.split(".");

if (sections.length >= 3) {
	sections = [sections[0], sections[1]];
}

// Remove any x's from the version string
dotnetSdkVersion = sections.filter((s) => s != "x").join(".");

if (!dotnetSDKVersionRegex.test(dotnetSdkVersion.trim().toLowerCase())) {
	printAsGitHubError(`The NET_SDK_VERSION variable is not a valid dotnet version: ${dotnetSdkVersion}`);
	Deno.exit(1);
}

// Find all of the csproj files for inspection
const csprojEntries = walkSync(baseSearchDirPath, {
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
	if (targetFrameworkRegex.test(fileData)) {
		try {
			currentSdkVersion = getCSProjTargetFrameworkVersion(fileData).replace("net", "");
		} catch (error) {
			const errMsg = error instanceof Error
				? error.message
				: `Failed to get target framework version for file '${csProjFile}': ${String(error)}`;
			nonMatchingVersions.push([csProjFile, errMsg]);
		}

		const versionsMatch = dotnetSdkVersion === currentSdkVersion;

		if (versionsMatch) {
			continue;
		}

		const errorMsg =
			`The current target framework version '${currentSdkVersion}' in the csproj file '${csProjFile}' does not match the expected` +
			` version of '${dotnetSdkVersion}'.  Please check the 'NET_SDK_VERSION' repository variable.`;
		nonMatchingVersions.push([csProjFile, errorMsg]);
	} else {
		filesWithoutTargetFramework.push(csProjFile);
	}
}

// If there are any issues with any of the files, print them out.
if (filesWithoutTargetFramework.length > 0 || nonMatchingVersions.length > 0) {
	filesWithoutTargetFramework.forEach((fileWithout) => {
		printAsGitHubError(`The file '${fileWithout}' does not have a target framework defined.`);
	});

	nonMatchingVersions.forEach((nonMatchingVersion) => {
		const errorMsg = `The file '${nonMatchingVersion[0]}' has a target framework version that does not ` +
			`match the NET_SDK_VERSION variable.\n${nonMatchingVersion[1]}`;
		printAsGitHubError(errorMsg);
	});

	Deno.exit(1);
}

/**
 * Gets the first occurrence of a dotnet target framework version found in the given {@link csProjFileData}.
 * @param csProjFileData The csproj file data that might contain the target framework version.
 * @returns The dotnet SDK version.
 */
function getCSProjTargetFrameworkVersion(csProjFileData: string): string {
	const tagMatches = csProjFileData.match(targetFrameworkRegex);

	const targetFrameworkTags = tagMatches === null || tagMatches.length === 0 ? [] : [...tagMatches];

	if (targetFrameworkTags.length === 0) {
		throw new Error("Could not find any target framework XML tags in the given csproj file data.");
	}

	const matches: string[] = targetFrameworkTags[0].match(csprojTargetFrameworkVersionRegex) ?? [];

	return matches.length > 0 ? matches[0] : "";
}

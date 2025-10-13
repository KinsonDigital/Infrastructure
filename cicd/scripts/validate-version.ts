import { printAsGitHubError, printAsGitHubNotice } from "../core/github.ts";
import { getEnvVar, isNotValidPreviewVersion, isNotValidProdVersion } from "../core/Utils.ts";

type ReleaseType = "production" | "preview";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

let version: string = getEnvVar("VERSION", scriptFileName).toLowerCase();
version = version.startsWith("v") ? version : `v${version}`;

const releaseType: ReleaseType = <ReleaseType> getEnvVar("RELEASE_TYPE", scriptFileName).toLowerCase();

const releaseTypeInvalid = releaseType != "production" && releaseType != "preview";

if (releaseTypeInvalid) {
	const errorMsg = `The version type argument '${releaseType}' is invalid.  Valid values are 'production' or 'preview'.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const versionIsInvalid = releaseType === "production" ? isNotValidProdVersion(version) : isNotValidPreviewVersion(version);

if (versionIsInvalid) {
	const releaseTypeStr = releaseType === "production" || releaseType === "preview" ? releaseType : "production or preview";
	const errorMsg = `\nThe version is not in the correct ${releaseTypeStr} version syntax.` +
		"\n\tThe production version syntax is as follows: v<major>.<minor>.<patch>" +
		"\n\tThe preview version syntax is as follows: v<major>.<minor>.<patch>-preview.<preview number>";

	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

printAsGitHubNotice(`✅The ${releaseType} version '${version}' is valid!!✅`);

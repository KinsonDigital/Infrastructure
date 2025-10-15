import { printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";
import { getEnvVar, isNotValidProdVersion, isNotValidPreviewVersion } from "../../cicd/core/Utils.ts";

type ReleaseType = "production" | "preview";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const version: string = getEnvVar("VERSION", scriptFileName).toLowerCase();
const releaseType: ReleaseType = <ReleaseType> getEnvVar("RELEASE_TYPE", scriptFileName).toLowerCase();
const stripVPrefix = getEnvVar("STRIP_V_PREFIX", scriptFileName, false) === "true";

const releaseTypeInvalid = releaseType != "production" && releaseType != "preview";

if (releaseTypeInvalid) {
	const errorMsg = `The version type argument '${releaseType}' is invalid.  Valid values are 'production' or 'preview'.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const versionIsInvalid = releaseType === "production"
	? isNotValidProdVersion(version, stripVPrefix)
	: isNotValidPreviewVersion(version, stripVPrefix);

if (versionIsInvalid) {
	const prefix = stripVPrefix ? "" : "v";
	const releaseTypeStr = releaseType === "production" || releaseType === "preview" ? releaseType : "production or preview";
	const errorMsg = `\nThe version is not in the correct ${releaseTypeStr} version syntax.` +
		`\n\tThe production version syntax is as follows: ${prefix}<major>.<minor>.<patch>` +
		`\n\tThe preview version syntax is as follows: ${prefix}<major>.<minor>.<patch>-preview.<preview number>`;

	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

printAsGitHubNotice(`The ${releaseType} version '${version}' is valid.`);

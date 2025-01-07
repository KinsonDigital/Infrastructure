import { existsSync } from "jsr:@std/fs@1.0.8/exists";
import getEnvVar from "../../cicd/core/GetEnvVar.ts";
import { Utils } from "../../cicd/core/Utils.ts";

const scriptName = import.meta.url.split("/").pop();

const tagName = getEnvVar("TAG_NAME", scriptName);
const releaseType = getEnvVar("RELEASE_TYPE", scriptName);

const releaseNotesFilePath = `./ReleaseNotes/${releaseType}Releases/Release-Notes-${tagName}.md`;

if (!existsSync(releaseNotesFilePath)) {
	const errorMsg = `The release notes file for version '${tagName}' does not exist.` +
		`\n\tError Location: ${scriptName}`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

Utils.printAsGitHubNotice(`The release notes file '${releaseNotesFilePath}' exists for version '${tagName}'.`);

import { existsSync } from "@std/fs";
import getEnvVar from "../../../cicd/core/GetEnvVar.ts";
import { Utils } from "../../../cicd/core/Utils.ts";

const scriptName = import.meta.url.split("/").pop();

let tag = getEnvVar("TAG_NAME", scriptName);
const releaseType = getEnvVar("RELEASE_TYPE", scriptName);
tag = tag.startsWith("v") ? tag : `v${tag}`;

const releaseNotesFilePath = `./ReleaseNotes/${releaseType}Releases/Release-Notes-${tag}.md`;

if (!existsSync(releaseNotesFilePath)) {
	const errorMsg = `The release notes file for version '${tag}' does not exist.` +
		`\n\tError Location: ${scriptName}`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

Utils.printAsGitHubNotice(`The release notes file '${releaseNotesFilePath}' exists for version '${tag}'.`);

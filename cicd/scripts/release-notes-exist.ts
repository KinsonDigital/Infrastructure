import { existsSync } from "@std/fs";
import getEnvVar from "../../cicd/core/GetEnvVar.ts";
import { printAsGitHubError, printAsGitHubNotice, trimPathBothEnds } from "../../cicd/core/Utils.ts";

const scriptName = import.meta.url.split("/").pop();

let relativeNotesDirPath = getEnvVar("RELATIVE_RELEASE_NOTES_DIR_PATH", scriptName);
relativeNotesDirPath = trimPathBothEnds(relativeNotesDirPath);

const releaseType = getEnvVar("RELEASE_TYPE", scriptName);
const tagName = getEnvVar("TAG_NAME", scriptName);

const releaseNotesFilePath = `./${relativeNotesDirPath}/${releaseType}Releases/Release-Notes-${tagName}.md`;

if (!existsSync(releaseNotesFilePath)) {
	const errorMsg = `The release notes file for version '${tagName}' does not exist.` +
		`\n\tError Location: ${scriptName}`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

printAsGitHubNotice(`The release notes file '${releaseNotesFilePath}' exists for version '${tagName}'.`);

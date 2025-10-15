import { existsSync } from "jsr:@std/fs@1.0.19";
import { getEnvVar, trimPathBothEnds } from "../../cicd/core/Utils.ts";
import { printAsGitHubError, printAsGitHubNotice, setGitHubOutput } from "../../cicd/core/github.ts";

const scriptName = import.meta.url.split("/").pop();

const outputName = "release-notes-exist";
let releaseNotesFilePath = getEnvVar("RELEASE_NOTES_FILE_PATH", scriptName);
releaseNotesFilePath = trimPathBothEnds(releaseNotesFilePath);
const failIfDoesNotExist = getEnvVar("FAIL_IF_DOES_NOT_EXIST", scriptName).toLowerCase() === "true";

const fileExists = existsSync(releaseNotesFilePath);

setGitHubOutput(outputName, fileExists ? "true" : "false");

if (failIfDoesNotExist && !fileExists) {
	const errorMsg = `The release notes file '${releaseNotesFilePath}' does not exist.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

printAsGitHubNotice(`The release notes file '${releaseNotesFilePath}' exists.`);

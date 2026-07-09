import { existsSync } from "jsr:@std/fs@1.0.23";
import { getEnvVar } from "../../cicd/core/Utils.ts";
import { printAsGitHubError, printAsGitHubNotice, setGitHubOutput } from "../../cicd/core/github.ts";

const scriptName = import.meta.url.split("/").pop();

const outputName = "release-notes-exist";
const relativeReleaseNotesFilePath = getEnvVar("RELATIVE_RELEASE_NOTES_FILE_PATH", scriptName);
const failIfDoesNotExist = getEnvVar("FAIL_IF_DOES_NOT_EXIST", scriptName).toLowerCase() === "true";

const fileExists = existsSync(relativeReleaseNotesFilePath);

setGitHubOutput(outputName, fileExists ? "true" : "false");

if (failIfDoesNotExist && !fileExists) {
	const errorMsg = `The release notes file '${relativeReleaseNotesFilePath}' does not exist.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

printAsGitHubNotice(`The release notes file '${relativeReleaseNotesFilePath}' exists.`);

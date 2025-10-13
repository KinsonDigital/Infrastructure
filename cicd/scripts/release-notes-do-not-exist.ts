import { existsSync } from "jsr:@std/fs@1.0.19";
import { printAsGitHubError } from "../core/github.ts";
import { getEnvVar } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const notesDirPath = getEnvVar("RELEASE_NOTES_DIR_PATH", scriptFileName);
const version = getEnvVar("VERSION", scriptFileName);

const notesFilePath = `${notesDirPath}/Release-Notes-${version}.md`;

if (!existsSync(notesFilePath)) {
	printAsGitHubError(`The release notes file '${notesFilePath}' does not exist.`);
	Deno.exit(1);
}

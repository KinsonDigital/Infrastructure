import { existsSync } from "@std/fs";
import getEnvVar from "../core/GetEnvVar.ts";
import { printAsGitHubError } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const notesDirPath = getEnvVar("RELEASE_NOTES_DIR_PATH", scriptFileName);
const version = getEnvVar("VERSION", scriptFileName);

const notesFilePath = `${notesDirPath}/Release-Notes-${version}.md`;

if (!existsSync(notesFilePath)) {
	printAsGitHubError(`The release notes file '${notesFilePath}' does not exist.`);
	Deno.exit(1);
}

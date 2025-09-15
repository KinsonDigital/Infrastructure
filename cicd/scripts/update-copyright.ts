import { existsSync, walkSync } from "jsr:@std/fs@1.0.19";
import getEnvVar from "../core/GetEnvVar.ts";
import { printAsGitHubError, printAsGitHubNotice, printAsGitHubWarning } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();
const csProjFileName = getEnvVar("CS_PROJ_FILE_NAME", scriptFileName);

const fileEntries = Array.from(walkSync(Deno.cwd(), {
	includeDirs: false,
	includeFiles: true,
	skip: [/\.git/, /\.vscode/, /bin/, /obj/],
	exts: [".csproj"],
}));

const foundEntries = fileEntries.find((entry) => entry.name === csProjFileName);

if (foundEntries === undefined) {
	printAsGitHubError(`The file ${csProjFileName} does not exist.`);
	Deno.exit(1);
}

const csProjFilePath = foundEntries.path;

if (!existsSync(csProjFilePath)) {
	printAsGitHubError(`The file ${csProjFilePath} does not exist.`);
	Deno.exit(1);
}

const fileContent = Deno.readTextFileSync(csProjFilePath);

if (fileContent === undefined || fileContent === null || fileContent === "") {
	printAsGitHubError("The file content is empty.");
	Deno.exit(1);
}

const copyRightRegex = /<Copyright>[\s\S]*?<\/Copyright>/gm;

const matchesResults = fileContent.match(copyRightRegex);

if (matchesResults === null) {
	printAsGitHubWarning("No matches found. This might be intentional.");
	Deno.exit(0);
}

const matches = Array.from(matchesResults);

if (matches.length <= 0) {
	printAsGitHubWarning("No matches found. This might be intentional.");
	Deno.exit(0);
}

const newTag = `<Copyright>Copyright ©${new Date().getFullYear()} Kinson Digital</Copyright>`;
const newFileContent = fileContent.replace(copyRightRegex, newTag);

Deno.writeTextFileSync(csProjFilePath, newFileContent);

printAsGitHubNotice(`The csharp project file ${csProjFilePath} copyright has been updated.`);

import { walkSync } from "jsr:@std/fs@1.0.19";
import { isNothing, printAsGitHubError, printAsGitHubNotice } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const projName = (Deno.env.get("PROJECT_NAME") ?? "").trim();

if (isNothing(projName)) {
	printAsGitHubError(`The 'PROJECT_NAME' environment variable does not exist.\n\t${scriptFileName}`);
	Deno.exit(1);
}

const baseDirPath = (Deno.env.get("BASE_DIR_PATH") ?? "").trim();

if (isNothing(baseDirPath)) {
	printAsGitHubError(`The 'BASE_DIR_PATH' environment variable does not exist.\n\t${scriptFileName}`);
	Deno.exit(1);
}

const token = (Deno.env.get("GITHUB_TOKEN") ?? "").trim();

if (isNothing(token)) {
	printAsGitHubError(`The 'GITHUB_TOKEN' environment variable does not exist.\n\t${scriptFileName}`);
	Deno.exit(1);
}

const filteredResults = [...walkSync(baseDirPath, {
	includeDirs: true,
	includeFiles: true,
	exts: [".csproj"],
	match: [new RegExp(`.*${projName}\\..*`)],
})].map((entry) => entry.path);

if (filteredResults.length <= 0) {
	const errorMsg = `No csproj files were found in '${baseDirPath}' for the project '${projName}'.`;
	printAsGitHubError(errorMsg);
	Deno.exit(300);
}

const outputFilePath = Deno.env.get("GITHUB_OUTPUT");

if (outputFilePath === undefined) {
	const errorMsg = "The GITHUB_OUTPUT environment variable is not set.";
	printAsGitHubError(errorMsg);
	Deno.exit(400);
}

const outputName = "project-file-path";
const csProjFilePath = filteredResults[0];
const output = `\n${outputName}=${csProjFilePath}`;

Deno.writeTextFileSync(outputFilePath, output);

printAsGitHubNotice(`Set output '${outputName}' set to a value of '${csProjFilePath}'.`);

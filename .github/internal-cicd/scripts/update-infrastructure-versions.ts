import { existsSync, walkSync } from "jsr:@std/fs@1.0.23";
import { RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.16/github";
import { TextLineStream } from "jsr:@std/streams@1.1.1/text-line-stream";
import { getEnvVar } from "../../../cicd/core/Utils.ts";
import { printAsGitHubError, printAsGitHubNotice } from "../../../cicd/core/github.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const baseDirPath = getEnvVar("BASE_DIR_PATH", scriptFileName);
const newVersion = getEnvVar("NEW_VERSION", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

if (!existsSync(baseDirPath)) {
	printAsGitHubError(`Directory '${baseDirPath}' does not exist.`);

	Deno.exit(1);
}

const newVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?$/;
const refTagLineRegex = /\s*ref: v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?\s*/;
const refTagVersionRegex = /ref: v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?/;

if (!newVersionRegex.test(newVersion) || newVersion === "v0.0.0") {
	printAsGitHubError(`The version '${newVersion}' is not a valid version number.`);

	Deno.exit(1);
}

const walkResult = walkSync(baseDirPath, {
	includeDirs: false,
	includeFiles: true,
	exts: [".yml", ".yaml"],
});

const allYMLFiles = Array.from(walkResult).map((e) => e.path);

const updateMsgs: string[] = [];
let noFilesUpdated = true;

// Process each file to see if it should be updated, and if so, update it
for await (const filePath of allYMLFiles) {
	const file = await Deno.open(filePath);
	const lines: string[] = [];

	for await (const line of file.readable.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream())) {
		lines.push(line);
	}

	const noNeedToUpdate = !lines.some((line) => refTagLineRegex.test(line));

	if (noNeedToUpdate) {
		continue;
	}

	const repoLineRegex = /repository: KinsonDigital\/Infrastructure/;

	// Find all references to the 'ref: <version' line
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// If the line is a ref line and not the first line
		if (i > 0 && refTagVersionRegex.test(line)) {
			// If the previous line is a 'repository: KinsonDigital/Infrastructure' line
			if (repoLineRegex.test(lines[i - 1])) {
				noFilesUpdated = false;
				lines[i] = lines[i].replace(refTagVersionRegex, `ref: ${newVersion}`);

				updateMsgs.push(`Updated repository reference for file '${filePath}:#${i + 1}' to version '${newVersion}'.`);
			}
		}
	}

	// Ensure that there is a single empty line at the end of the file.
	lines[lines.length - 1] += "\n";

	const updatedFileContent = lines.join("\n");

	Deno.writeTextFileSync(filePath, updatedFileContent);
}

// If no files were updated
if (noFilesUpdated) {
	printAsGitHubNotice("No files needed updating.");
} else {
	updateMsgs.sort();
	updateMsgs.forEach((updateMsg) => {
		printAsGitHubNotice(`${updateMsg}`);
	});
}

const repoVarName = "INFRASTRUCTURE_VERSION";
const repoClient = new RepoClient(ownerName, repoName, token);

if (!(await repoClient.variableExists(repoVarName))) {
	printAsGitHubError(`The repository variable '${repoVarName}' does not exist.`);

	Deno.exit(1);
}

const scriptVersionVar = (await repoClient.getVariables()).find((v) => v.name == repoVarName);

await repoClient.updateVariable(repoVarName, newVersion);
printAsGitHubNotice(`Updated repository variable '${repoVarName}' from version '${scriptVersionVar?.value}' to '${newVersion}'.`);

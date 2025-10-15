import { existsSync, walkSync } from "jsr:@std/fs@1.0.19";
import { RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { getEnvVar } from "../../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const baseDirPath = getEnvVar("BASE_DIR_PATH", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);
const newVersion = getEnvVar("NEW_VERSION", scriptFileName);

if (!existsSync(baseDirPath)) {
	console.log(`%cDirectory '${baseDirPath}' does not exist.`, "color: red");
	Deno.exit(0);
}

const tagRegex = /v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?/gm;

if (!tagRegex.test(newVersion)) {
	console.log(`%cThe version '${newVersion}' is not a valid version number.`, "color: red");
	Deno.exit(0);
}

const walkResult = walkSync(baseDirPath, {
	includeDirs: false,
	includeFiles: true,
	exts: [".yml", ".yaml"],
});

const yamlFiles = Array.from(walkResult).map((e) => e.path);
const reusableWorkflowRegex = /uses: .+.(yml|yaml)@v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?/gm;

const updateMsgs: string[] = [];
let noFilesUpdated = true;

// Search for workflow references with a version that has not been updated
yamlFiles.forEach((yamlFile) => {
	let fileContent = Deno.readTextFileSync(yamlFile);

	const possibleUpdates = fileContent.match(reusableWorkflowRegex)?.map((w) => w) ?? [];

	let fileUpdated = false;

	// Check each reusable workflow reference version
	possibleUpdates.forEach((oldRef) => {
		const refPathSection = oldRef.split("uses:")[1].trim().split("@")[0];
		const workflowRefVersion = oldRef.split("@")[1];

		// If the workflow version has not been updated
		if (workflowRefVersion != newVersion) {
			fileUpdated = true;
			noFilesUpdated = false;
			const newRef = `uses: ${refPathSection}@${newVersion}`;

			// Update the reusable workflow reference version
			fileContent = fileContent.replaceAll(oldRef, newRef);

			const noticeMsg =
				`Updated reusable workflow reference '${refPathSection}' from version '${workflowRefVersion}' to '${newVersion}'.`;
			updateMsgs.push(noticeMsg);
		}
	});

	// If anything has been updated, save the file
	if (fileUpdated) {
		// Save the changes to the file
		Deno.writeTextFileSync(yamlFile, fileContent);
	}
});

// If no files were updated
if (noFilesUpdated) {
	console.log("%cNo files needed updating.", "color: cyan");
} else {
	updateMsgs.sort();
	updateMsgs.forEach((updateMsg) => {
		console.log(`%c${updateMsg}`, "color: cyan");
	});
}

const repoVarName = "INFRASTRUCTURE_VERSION";
const repoClient = new RepoClient(ownerName, repoName, token);

if (!(await repoClient.variableExists(repoVarName))) {
	console.log(`%cThe repository variable '${repoVarName}' does not exist.`, "color: red");
	Deno.exit(0);
}

const scriptVersionVar = (await repoClient.getVariables()).find((v) => v.name == repoVarName);

await repoClient.updateVariable(repoVarName, newVersion);

const msg = `%cUpdated repository variable '${repoVarName}' from version '${scriptVersionVar?.value}' to '${newVersion}'.`;
console.log(msg, "color: cyan");

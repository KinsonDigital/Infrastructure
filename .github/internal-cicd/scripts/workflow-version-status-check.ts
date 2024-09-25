import { walkSync } from "@std/fs/walk";
import { exists } from "@std/fs/exists";
import { basename } from "@std/path/basename";
import { TagClient } from "../../../deps.ts";
import { Utils } from "../../../cicd/core/Utils.ts";
import getEnvVar from "../../../cicd/core/GetEnvVar.ts";
import { validateOrgExists, validateRepoExists } from "../../../cicd/core/Validators.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
let baseDirPath = getEnvVar("BASE_DIR_PATH", scriptFileName);
baseDirPath = Utils.normalizePath(baseDirPath);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

if (!exists(baseDirPath)) {
	Utils.printAsGitHubError(`Directory '${baseDirPath}' does not exist.`);
	Deno.exit(1);
}

const yamlFiles = [...walkSync(baseDirPath, {
	includeDirs: false,
	includeFiles: true,
	exts: [".yaml", ".yml"],
})].map((e) => e.path);

const tagClient: TagClient = new TagClient(ownerName, repoName, token);

const existingReleaseTags = (await tagClient.getAllTags()).map((t) => t.name);

const workflowsToUpdate: WorkflowToUpdate[] = [];

const reusableWorkflowRegex = /uses: .+.(yml|yaml)@v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?/gm;

type WorkflowToUpdate = {
	/**
	 * The file path to the workflow.
	 */
	filePath: string;

	/**
	 * The reusable workflow references that need to be updated.
	 */
	workflowRefs: string[];
};

// Search for workflow references with a version that has not been updated
yamlFiles.forEach(yamlFile => {
	const workflowToUpdate: WorkflowToUpdate = {
		filePath: yamlFile,
		workflowRefs: []
	};

	const fileContent = Deno.readTextFileSync(yamlFile);

	const possibleUpdates = fileContent.match(reusableWorkflowRegex)?.map((w) => w) ?? [];

	// Check each reusable workflow reference version 
	possibleUpdates.forEach(possibleUpdate => {
		const fullRef = possibleUpdate.split("uses:")[1].trim();
		const workflowRefVersion = possibleUpdate.split("@")[1];

		// If the workflow version has not been updated
		if (existingReleaseTags.includes(workflowRefVersion)) {
			workflowToUpdate.workflowRefs.push(fullRef);
		}
	});

	if (workflowToUpdate.workflowRefs.length > 0) {
		workflowsToUpdate.push(workflowToUpdate);
	}
});

// If there are no workflows to update, then exit
if (workflowsToUpdate.length === 0) {
	Utils.printAsGitHubNotice("No workflows to update.");
	Deno.exit(0);
}

const errorMsgs: string[] = [];

// Print out all of the workflows that need to be updated as an error
workflowsToUpdate.forEach(workflowToUpdate => {
	const filePath = basename(workflowToUpdate.filePath);

	const workflowErrors: string[] = workflowToUpdate.workflowRefs.map((workflowRef) => {
		return `Workflow reference '${workflowRef}' in file '${filePath}' needs to be updated.`;
	});

	errorMsgs.push(...workflowErrors);
});

if (errorMsgs.length > 0) {
	Utils.printAsGitHubErrors(errorMsgs);
	Deno.exit(1);
}

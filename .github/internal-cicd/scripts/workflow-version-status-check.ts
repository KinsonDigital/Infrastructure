import { TagClient } from "../../../deps.ts";
import { Directory } from "../../../deps.ts";
import { File } from "../../../cicd/core/File.ts";
import { Path } from "../../../cicd/core/Path.ts";
import { Utils } from "../../../cicd/core/Utils.ts";

if (Deno.args.length != 2) {
	let errorMsg = "Invalid number of arguments.";
	errorMsg += "\nArg 1: Fully qualified directory path of where to search for YAML files.";
	errorMsg += "\nArg 2: GitHub token.";
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

let baseDirPath = Deno.args[0];
const token = Deno.args[1];

baseDirPath = Utils.normalizePath(baseDirPath.trim());

if (!Directory.Exists(baseDirPath)) {
	Utils.printAsGitHubError(`Directory '${baseDirPath}' does not exist.`);
	Deno.exit(1);
}

const ownerName = "KinsonDigital";
const repoName = "Infrastructure";
const allFiles = Directory.getFiles(baseDirPath, true);

const yamlFiles = allFiles.filter((file) => file.toLowerCase().endsWith(".yaml") || file.toLowerCase().endsWith(".yml"));
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

	const fileContent = File.LoadFile(yamlFile);

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
	const filePath = Path.getFileName(workflowToUpdate.filePath);

	const workflowErrors: string[] = workflowToUpdate.workflowRefs.map((workflowRef) => {
		return `Workflow reference '${workflowRef}' in file '${filePath}' needs to be updated.`;
	});

	errorMsgs.push(...workflowErrors);
});

if (errorMsgs.length > 0) {
	Utils.printAsGitHubErrors(errorMsgs);
	Deno.exit(1);
}

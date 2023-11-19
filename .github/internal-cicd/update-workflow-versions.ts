import { TagClient, RepoClient } from "../../deps.ts";
import { Input} from "../../deps.ts";
import chalk from "../../deps.ts";
import { File } from "../../cicd/core/File.ts";
import { Directory } from "../../deps.ts";
import { Utils } from "../../cicd/core/Utils.ts";

if (Deno.args.length != 2) {
	let errorMsg = "Invalid number of arguments.";
	errorMsg += "\nArg 1: Fully qualified directory path of where to search for YAML files.";
	errorMsg += "\nArg 2: GitHub token.";
	console.log(chalk.red(errorMsg));
	Deno.exit(0);
}

let baseDirPath = Deno.args[0];
const token = Deno.args[1];

baseDirPath = Utils.normalizePath(baseDirPath.trim());

if (!Directory.Exists(baseDirPath)) {
	console.log(chalk.red(`Directory '${baseDirPath}' does not exist.`));
	Deno.exit(0);
}

// Clear the console so the token is not visible from the tasks.json file
console.clear();

const tagRegex = /v[0-9]+\.[0-9]+\.[0-9]+/gm;

const newVersion = await Input.prompt({
	message: chalk.blue("Enter version to upgrade workflows to:"),
	hint: "Use a tag with the syntax 'v#.#.#'.",
	minLength: 5,
	validate: (value) => {
		return tagRegex.test(value.trim().toLowerCase());
	},
	transform: (value) => {
		value = value.trim().toLowerCase();

		return value.startsWith("v") ? value : `v${value}`;
	}
});

const ownerName = "KinsonDigital";
const repoName = "Infrastructure";
const allFiles = Directory.getFiles(baseDirPath, true);

const yamlFiles = allFiles.filter((file) => file.toLowerCase().endsWith(".yaml") || file.toLowerCase().endsWith(".yml"));
const tagClient: TagClient = new TagClient(ownerName, repoName, token);

const allTags = (await tagClient.getAllTags()).map((t) => t.name);

// If the new tag already exists, throw an error
if (allTags.includes(newVersion)) {
	console.log(chalk.red(`Tag '${newVersion}' already exists.`));
	Deno.exit(0);
}

const reusableWorkflowRegex = /uses: .+.(yml|yaml)@v[0-9]+\.[0-9]+\.[0-9]+/gm;

const updateMsgs: string[] = [];
let noFilesUpdated = true;

// Search for workflow references with a version that has not been updated
yamlFiles.forEach(yamlFile => {
	let fileContent = File.LoadFile(yamlFile);

	const possibleUpdates = fileContent.match(reusableWorkflowRegex)?.map((w) => w) ?? [];

	let fileUpdated = false;

	// Check each reusable workflow reference version 
	possibleUpdates.forEach(oldRef => {
		const refPathSection = oldRef.split("uses:")[1].trim().split("@")[0];
		const workflowRefVersion = oldRef.split("@")[1];

		// If the workflow version has not been updated
		if (workflowRefVersion != newVersion) {
			fileUpdated = true;
			noFilesUpdated = false;
			const newRef = `uses: ${refPathSection}@${newVersion}`;

			// Update the reusable workflow reference version
			fileContent = fileContent.replaceAll(oldRef, newRef);

			const noticeMsg = `Updated reusable workflow reference '${refPathSection}' from version '${workflowRefVersion}' to '${newVersion}'.`;
			updateMsgs.push(noticeMsg);
		}
	});

	// If anything has been updated, save the file
	if (fileUpdated) {
		// Save the changes to the file
		File.SaveFile(yamlFile, fileContent);
	}
});

// If no files were updated
if (noFilesUpdated) {
	console.log(chalk.cyan("No files needed updating."));
} else {
	updateMsgs.sort();
	updateMsgs.forEach(updateMsg => {
		console.log(chalk.cyan(updateMsg));
	});
}

const repoVarName = "CICD_SCRIPTS_VERSION";
const repoClient = new RepoClient(ownerName, repoName, token);

if (!(await repoClient.repoVariableExists(repoVarName))) {
	console.log(chalk.red(`The repository variable '${repoVarName}' does not exist.`));
	Deno.exit(0);
}

const scriptVersionVar = (await repoClient.getVariables()).find((v) => v.name == repoVarName);

await repoClient.updateVariable(repoVarName, newVersion);

console.log(chalk.cyan(`Updated repository variable '${repoVarName}' from version '${scriptVersionVar?.value}' to '${newVersion}'.`));

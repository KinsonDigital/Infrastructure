import { delay } from "jsr:@std/async@1.0.15";
import { existsSync, walkSync } from "jsr:@std/fs@1.0.19";
import { Input } from "jsr:@cliffy/prompt@1.0.0-rc.8/input";
import { Select } from "jsr:@cliffy/prompt@1.0.0-rc.8/select";
import { IssueOrPRRequestData } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/core";
import { IssueClient, ProjectClient, PullRequestClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import {
	branchExistsLocally,
	branchExistsRemotely,
	checkoutBranch,
	createCheckoutBranch,
	createEmptyCommit,
	isCheckedOut,
	pushToRemote,
} from "../cicd/core/git.ts";
import { printError, printStatusUpdate, printStep } from "./core/console-msgs.ts";

const token = (Deno.env.get("CICD_TOKEN") ?? "").trim();
const prReviewer = "KinsonDigitalAdmin";

if (token === undefined || token === null || token === "") {
	console.log("The environment variable 'EA_DEV_TOKEN' does not exist.");
	Deno.exit(1);
}

const GET_DIR_PATH = "./.git";
const GIT_CONFIG_FILE_PATH = "./.git/config";

// If the git dir path or git config file path do not exist, notify the user and stop the process
if (!existsSync(GET_DIR_PATH, { isDirectory: true }) || !existsSync(GIT_CONFIG_FILE_PATH, { isFile: true })) {
	printError("Not a valid git repository");

	Deno.exit(1);
}

let repoOwnerName = "";
let repoName = "";

try {
	printStep("Validating repository");
	printStatusUpdate("Validating repository");
	const gitConfigFileData = Deno.readTextFileSync(GIT_CONFIG_FILE_PATH);
	const remoteOriginMatch = gitConfigFileData.match(/\[remote "origin"\][\s\S]*?url = (.+)/m) ?? "";

	if (remoteOriginMatch === null) {
		printError("The repository does not have a remote configured.");

		Deno.exit(1);
	}

	const remoteText = remoteOriginMatch[0];

	const urlRegex = /url = (.+)/;
	const urlMatch = remoteText.match(urlRegex);

	if (urlMatch === null) {
		printError("The repository does not have a remote 'origin' URL configured.");

		Deno.exit(1);
	}

	const urlMatchText = urlMatch[0];
	let url = urlMatchText.split("=")[1].trim();
	const githubUrlRegex = /https:\/\/github\.com\/(.+\/)(.+)\.git/;

	if (!githubUrlRegex.test(url)) {
		printError("The remote 'origin' URL is not a valid GitHub URL.");
		Deno.exit(1);
	}

	printStatusUpdate("Getting GitHub repository owner and name");
	url = url.replace("https://github.com/", "").replace(".git", "");
	const urlSections = url.split("/");
	[repoOwnerName, repoName] = urlSections;

	printStatusUpdate(`Repository owner ${repoOwnerName}`);
	printStatusUpdate(`Repository name ${repoName}`, true);
} catch (error) {
	const errMsg = error instanceof Error ? error.message : "An error occurred reading the git config file.";
	printError(errMsg);

	Deno.exit(1);
}

// Validates that the issue number exists
const issueClient = new IssueClient(repoOwnerName, repoName, token);

// Ask the user for an issue number
const issueNumberResult = await Input.prompt({
	message: "Enter the issue number:",
	info: true,
	validate: async (value: string) => {
		if (isNaN(Number(value))) {
			return "Issue number must be a valid number.";
		}

		if (value.includes(".")) {
			return "The issue number must be a whole number.";
		}

		if (Number(value) <= 0) {
			return "The issue number must be greater than zero.";
		}

		try {
			const issueExists = await issueClient.exists(Number(value));

			if (!issueExists) {
				return `The issue '${value}' does not exist.`;
			}
		} catch {
			return `The issue number '${value}' does not exist or there was an error fetching it.`;
		}

		return true;
	},
});

const issueNumber = Number(issueNumberResult);

// Ask the user for a branch name description
const featureBranch = await Input.prompt({
	message: "Enter the branch name:",
	hint: "my feature branch",
	validate: (value: string) => {
		if (value.trim() === "") {
			return "Branch name cannot be empty.";
		}

		const regex = /^[a-zA-Z\-]+$/gm;
		// Remove leading and trailing hyphens, trim, lowercase, and replace spaces and underscores with hyphens
		value = value.trim().toLowerCase()
			.replaceAll(" ", "-")
			.replaceAll("_", "-")
			.replace(/-{2,}/g, "-")
			.replace(/^-+/, "")
			.replace(/-+$/, "");

		if (!regex.test(value)) {
			printError("Branch name must match the pattern 'feature/123-my-branch'.");

			return false;
		}

		return true;
	},
	transform: (value) => {
		const transformedValue = value.trim().toLowerCase()
			.replaceAll(" ", "-")
			.replaceAll("_", "-")
			.replace(/-{2,}/g, "-") // 2 or more consecutive hyphens
			.replace(/^-+/, "")
			.replace(/-+$/, "");

		return `feature/${issueNumber}-${transformedValue}`;
	},
});

const chosenBaseBranch = await Select.prompt({
	message: "Choose the pull request base branch:",
	options: ["main", "develop"],
});

// If the chosen branch exists
if (await branchExistsLocally(chosenBaseBranch)) {
	// If the chosen base branch is not checked out, checkout the branch
	if (!(await isCheckedOut(chosenBaseBranch))) {
		printStatusUpdate(`Checking out the local branch '${chosenBaseBranch}'.`);
		await checkoutBranch(chosenBaseBranch);
	}
} else if (await branchExistsRemotely(chosenBaseBranch)) {
	printStatusUpdate(`Checking out the remote branch '${chosenBaseBranch}'.`);
	await checkoutBranch(chosenBaseBranch);
} else {
	printStatusUpdate(`Creating and checking out the branch '${chosenBaseBranch}'.`);
	await createCheckoutBranch(chosenBaseBranch);
	printStatusUpdate(`Pushing the branch '${chosenBaseBranch}' to remote.`);
	await pushToRemote(chosenBaseBranch);
}

try {
	// Create a branch using git commands from the currently checked out branch.
	printStatusUpdate(`Creating branch '${featureBranch}'`);
	await createCheckoutBranch(featureBranch);

	// Create an empty commit
	printStatusUpdate("Creating empty start commit");
	await createEmptyCommit(`Start work for issue #${issueNumber}`);

	// Push the branch to remote
	printStatusUpdate(`Pushing branch to remote`);
	await pushToRemote(featureBranch);

	// Delay for 1 second to allow GitHub to finalize the branch creation
	await delay(1000);

	const issue = await issueClient.getIssue(issueNumber);

	printStatusUpdate("Searching for 'pr-template.md' file");
	const templateFiles = Array.from(walkSync("./", { includeFiles: true, match: [/pr-template\.md$/] }))
		.map((entry) => entry.path);

	const prTemplateFilePath = templateFiles.length > 0 ? templateFiles[0] : "";
	const noTemplateFoundDescription = "No template file 'pr-template.md' was found.";
	const templateFound = prTemplateFilePath !== "";

	if (templateFound) {
		printStatusUpdate(`Found pull request template at '${prTemplateFilePath}'`);
	} else {
		printStatusUpdate(noTemplateFoundDescription);
	}

	let prDescription = templateFound ? await Deno.readTextFile(prTemplateFilePath) : noTemplateFoundDescription;

	// Replace issue number placeholder with actual issue number
	prDescription = prDescription.replace("{ISSUE_NUMBER}", issue.number.toString());

	// Create a pull request
	const prClient = new PullRequestClient(repoOwnerName, repoName, token);

	printStatusUpdate("Creating pull request");
	const newPr = await prClient.createPullRequest(
		issue.title ?? "WIP - Please update title",
		featureBranch,
		chosenBaseBranch,
		prDescription,
		true,
		true,
	);

	printStatusUpdate(`Setting pull request reviewer to '${prReviewer}'`);
	await prClient.requestReviewers(newPr.number, prReviewer);

	const prData: IssueOrPRRequestData = {
		labels: issue.labels.map((l) => l.name),
		assignees: issue.assignees.map((a) => a.login),
		milestone: issue.milestone?.number,
	};

	// Update the labels assignees, and milestone to match the linked issue
	printStatusUpdate(`Setting pull request assignees, labels, and milestone to match issue '${newPr.number}'.`);
	await prClient.updatePullRequest(newPr.number, prData);

	const projClient = new ProjectClient(repoOwnerName, repoName, token);

	printStatusUpdate("Getting issue projects");
	const issueProjects = await projClient.getIssueProjects(issueNumber);

	// Sync all of the issue projects to the pull request
	for await (const issueProject of issueProjects) {
		printStatusUpdate(`Adding pull request to project '${issueProject.title}'`);
		await projClient.addPullRequestToProject(newPr.number, issueProject.title);
	}

	printStep(`Pull request '#${newPr.number}' has been created successfully!`);
	printStep(`URL: ${newPr.html_url}`);
} catch (error) {
	const errMsg = error instanceof Error ? error.message : "An error occurred.";
	printError(errMsg);

	console.log("\n%cCheck the following fine-grained access token permissions:", "color:yellow");
	console.log("\t%cRepo Permissions:", "color:yellow");
	console.log("\t  %cContents: read & write", "color:yellow");
	console.log("\t  %cIssues: read only", "color:yellow");
	console.log("\t  %cMetadata: read only", "color:yellow");
	console.log("\t  %cPull requests: read & write", "color:yellow");
	console.log("\t%cOrg Permissions:", "color:yellow");
	console.log("\t  %cProjects: read & write", "color:yellow");
}

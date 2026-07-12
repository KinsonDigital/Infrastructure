import { existsSync } from "jsr:@std/fs@1.0.23";
import { Input } from "jsr:@cliffy/prompt@1.0.1";
import {
	branchExistsLocally,
	branchExistsRemotely,
	checkoutBranch,
	createCheckoutBranch,
	createCommit,
	isCheckedOut,
	noUncommittedChangesExist,
	pushToRemote,
	stageFiles,
	uncommittedChangesExist,
} from "jsr:@kinsondigital/sprocket@3.0.0/git";
import { LabelClient, MilestoneClient, ProjectClient, PullRequestClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.16";
import { IssueOrPRRequestData } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.16/core";
import { printGray } from "jsr:@kinsondigital/sprocket@3.0.0/console";
import { GeneratorSettings, ReleaseNotesGenerator } from "jsr:@kinsondigital/sprocket@3.0.0/releases";
import denoConfig from "../deno.json" with { type: "json" };

const token = (Deno.env.get("CICD_TOKEN") ?? "").trim();

if (token === "") {
	console.log("The environment variable 'CICD_TOKEN' is required.");
	Deno.exit(1);
}

const denoConfigFileName = "deno.json";
const denoFilePath = `./${denoConfigFileName}`;

const ownerName = "KinsonDigital";
const repoName = "Infrastructure";
const prodLabel = "production-release";
const baseBranch = "main";

// Ask the user for a version number
const releaseVersion = await Input.prompt({
	message: "Enter the release version:",
	validate: (value) => {
		const prodVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)$/gm;

		return prodVersionRegex.test(value.trim().toLowerCase());
	},
	transform: (value) => {
		const result = value.trim().toLowerCase();

		return result.startsWith("v") ? result : `v${result}`;
	},
});

printGray(`⌛Validating the label '${prodLabel}'. . .`);
const labelClient = new LabelClient(ownerName, repoName, token);
const labelExists = await labelClient.exists(prodLabel);

if (!labelExists) {
	console.error(
		`The label '${prodLabel}' does not exist in the repository '${ownerName}/${repoName}'.`,
	);
	Deno.exit(1);
}

const settingsFileName = "prod-gen-release-notes-settings.json";
const settingsFilePath = `${Deno.cwd()}/release-notes/${settingsFileName}`;

if (!existsSync(settingsFilePath)) {
	console.error(
		`The release notes settings file '${settingsFileName}' does not exist.`,
	);
	Deno.exit(1);
}

printGray(`⌛Checking if the branch '${baseBranch}' exists locally. . .`);
// Check if the main branch is checked out
if (await branchExistsLocally(baseBranch)) {
	// If the base branch is checked out
	if (await isCheckedOut(baseBranch)) {
		if (await uncommittedChangesExist()) {
			console.log(
				`You have uncommitted changes in your working directory. Please commit or stash them before preparing a release.`,
			);
			Deno.exit(1);
		}
	} else {
		if (await noUncommittedChangesExist()) {
			await checkoutBranch(baseBranch);
		} else {
			console.log(
				`You have uncommitted changes in your working directory. Please commit or stash them before preparing a release.`,
			);
			Deno.exit(1);
		}
	}
} else {
	printGray(`⌛Checking if the branch '${baseBranch}' exists remotely. . .`);
	if (await branchExistsRemotely(baseBranch)) {
		await checkoutBranch(baseBranch);
	} else {
		console.log(
			`The base branch '${baseBranch}' does not exist locally or remotely. Please create it before preparing a release.`,
		);
		Deno.exit(1);
	}
}

const headBranch = "release";

printGray(`⌛Creating the branch '${headBranch}'. . .`);
await createCheckoutBranch(headBranch);

printGray(`⌛Updating the version in the '${denoFilePath}' file. . .`);

denoConfig.version = releaseVersion;

Deno.writeTextFileSync("./deno.json", `${JSON.stringify(denoConfig, null, 4)}\n`);

printGray("⌛\tStaging version changes. . .");
await stageFiles([`*${denoConfigFileName}`]);
printGray("⌛\tCreating commit for version changes. . .");

// If there are changes to commit
if (await uncommittedChangesExist()) {
	await createCommit(`release: update version to ${releaseVersion}`);
}

printGray("⌛Generating release notes. . .");
const releaseNotesFileName = `Release-Notes-${releaseVersion}.md`;
const releaseNotesFilePath = `${Deno.cwd()}/release-notes/production-releases/${releaseNotesFileName}`;
const generator: ReleaseNotesGenerator = new ReleaseNotesGenerator();
const settingsFileContent = Deno.readTextFileSync(settingsFilePath);
const settings: GeneratorSettings = JSON.parse(settingsFileContent);
settings.version = `vnext`;

const notes = await generator.generateNotes(settings);
notes.replace("Infrastructure  Release Notes - vnext", `Infrastructure  Release Notes - ${releaseVersion}`);

Deno.writeTextFileSync(releaseNotesFilePath, notes);

printGray("⌛\tStaging release note changes. . .");
await stageFiles([`*${releaseNotesFileName}`]);
printGray("⌛\tCreating commit for release note changes. . .");
await createCommit(
	`release: create release notes for version ${releaseVersion}`,
);

printGray("⌛Pushing changes to remote. . .");
await pushToRemote(headBranch);

const title = `🚀Production Release (${releaseVersion})`;
const assignee = "CalvinWilkinson";
const githubProjectName = "KD-Team";
const reviewer = "KinsonDigitalAdmin";

const prodReleasePrTemplateFilePath = `${Deno.cwd()}/templates/prod-prepare-release-template.md`;
const templateFileContent = Deno.readTextFileSync(
	prodReleasePrTemplateFilePath,
);

printGray(`⌛Getting milestone data. . .`);
const milestoneClient = new MilestoneClient(ownerName, repoName, token);
const milestone = await milestoneClient.getMilestoneByName(`vnext`);

printGray(
	`⌛Creating pull request to merge the branch '${headBranch}' into the branch '${baseBranch}'. . .`,
);
const prClient = new PullRequestClient(ownerName, repoName, token);
const newPr = await prClient.createPullRequest(
	title,
	headBranch,
	baseBranch,
	templateFileContent,
);

printGray(`⌛Setting the pull request reviewer to '#${reviewer}'. . .`);
await prClient.requestReviewers(newPr.number, [reviewer]);

printGray(
	`⌛Updating pull request '#${newPr.number}' assignee, label, and milestone. . .`,
);
const prData: IssueOrPRRequestData = {
	assignees: [assignee],
	labels: [prodLabel],
	milestone: milestone.number,
};

await prClient.updatePullRequest(newPr.number, prData);

printGray(
	`⌛Adding pull request '#${newPr.number}' to project '${githubProjectName}'. . .`,
);
const projClient = new ProjectClient(ownerName, repoName, token);

await projClient.addPullRequestToProject(newPr.number, githubProjectName);

const prUrl = `https://github.com/${ownerName}/${repoName}/pull/${newPr.number}`;
console.log(`Pull Request: ${prUrl}`);

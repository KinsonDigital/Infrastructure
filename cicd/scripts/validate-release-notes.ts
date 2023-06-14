import { File } from "../core/File.ts";
import { LabelClient } from "../clients/LabelClient.ts";
import { MilestoneClient } from "../clients/MilestoneClient.ts";
import { Utils } from "../core/Utils.ts";
import { RepoClient } from "../clients/RepoClient.ts";

const scriptName = Utils.getScriptName();

if (Deno.args.length < 3) {
	let errorMsg =
		`The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
	errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
	errorMsg += "\nThe 2nd arg is required and must be the type of release.";
	errorMsg += "\n\tValid values are 'production' and 'preview' and are case-insensitive.";

	errorMsg += "\nThe 3rd arg is required and must be the version of the release.";
	errorMsg += "\nThe 4th arg is optional and must be a label of a PR to enforce the PR to be in the release notes.";
	errorMsg += "\nThe 5th arg is optional and must be the GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
let releaseType = Deno.args[1].trim();
let version = Deno.args[2].trim().toLowerCase();
const prLabel = Deno.args.length >= 3 ? Deno.args[3].trim() : "";
const token = Deno.args.length >= 4 ? Deno.args[4].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Release Type (Required): ${releaseType}`,
	`Version (Required): ${version}`,
	`PR Label (Optional): ${Utils.isNullOrEmptyOrUndefined(prLabel) ? "Not Provided" : prLabel}}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}}`,
]);

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

// Check the release type and make sure that it is all lowercase except the first letter
const allButFirstLetter = releaseType.slice(1).toLowerCase();
const firstLetter = releaseType.slice(0, 1).toUpperCase();
releaseType = `${firstLetter}${allButFirstLetter}`;

if (releaseType != "Production" && releaseType != "Preview") {
	Utils.printAsGitHubError(
		`The release type '${releaseType}' is invalid.  It must be either 'Production' or 'Preview'.`,
	);
	Deno.exit(1);
}

// Make sure the version starts with a 'v'
version = version.startsWith("v") ? version : `v${version}`;

const noPRLabel = Utils.isNullOrEmptyOrUndefined(prLabel);
const prLabelGiven = !noPRLabel;

const problemsFound: string[] = [];

// Check that the label exists
if (prLabelGiven) {
	const labelClient: LabelClient = new LabelClient(token);
	const labelExists = await labelClient.labelExists(repoName, prLabel);

	if (!labelExists) {
		problemsFound.push(`The label '${prLabel}' does not exist in the repo '${repoName}'.`);
	}
}

const issueLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/issues\/[0-9]*\)/gm;
const prLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/pull\/[0-9]*\)/gm;
const title = new RegExp(`${repoName} ${releaseType} Release Notes - ${version}`, "gm");

const milestoneClient = new MilestoneClient();
const issues = await milestoneClient.getIssues(repoName, version);
const prs = await milestoneClient.getPullRequests(repoName, version);

const pullRequests = noPRLabel ? [] : prs.filter((pr) => pr.labels.includes(prLabel));

const releaseNotesFilePath = `${Deno.cwd()}/cicd/test-release-notes.md`;
const releaseNoteFileData: string = File.LoadFile(releaseNotesFilePath);
const issueLinks: string[] = releaseNoteFileData.match(issueLinkRegex) ?? [];
const prLinks: string[] = noPRLabel ? [] : releaseNoteFileData.match(prLinkRegex) ?? [];

// If the title is incorrect, add to the list of errors found
if (releaseNoteFileData.match(title) === null) {
	problemsFound.push(
		`The title of the release notes is incorrect.  It should be '${repoName} ${releaseType} Release Notes - ${version}'.`,
	);
}

// Check that all of the issues exist in the release notes
issues.forEach((issue) => {
	const issueLink = `[#${issue.number}](${issue.html_url})`;

	if (!issueLinks.includes(issueLink)) {
		problemsFound.push(`The issue link for issue '${issue.number}' does not exist in the release notes.`);
	}
});

pullRequests.forEach((pr) => {
	const prLink = `[#${pr.number}](${pr.html_url})`;

	if (!prLinks.includes(prLink)) {
		problemsFound.push(
			`The pr link for issue '${pr.number}' with the label '${prLabel}' does not exist in the release notes.`,
		);
	}
});

Utils.printProblemList(problemsFound).then(() => {
	console.log("✅No problems found!!  Release notes are valid.✅");
}).catch((error) => {
	Utils.printAsGitHubError(error);
	Deno.exit(1);
});

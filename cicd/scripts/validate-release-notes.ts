import { File } from "../core/File.ts";
import { LabelClient } from "../core/LabelClient.ts";
import { MilestoneClient } from "../core/MilestoneClient.ts";
import { Utils } from "../core/Utils.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";

const scriptName = Utils.getScriptName()
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length < 3) {
    let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
    errorMsg += "\nThe 1st arg must be the GitHub project name.";
    errorMsg += "\nThe 2nd arg must be the type of release. Valid values are 'Production' and 'Preview'.";
    errorMsg += "\nThe 3rd arg must be the version of the release.";
    errorMsg += "\nThe 4th arg is optional and must be a label of a PR to enforce the PR to be in the release notes.";
    errorMsg += "\nThe 5th arg is optional and must be the GitHub token.";

    console.log(`::error::${errorMsg}`);
    Deno.exit(1);
}

const projectName = Deno.args[0].trim();
let releaseType = Deno.args[1].trim();
let version = Deno.args[2].trim().toLowerCase();
const prLabel = Deno.args.length >= 3 ? Deno.args[3].trim() : "";
const token = Deno.args.length >= 4 ? Deno.args[4].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
    `Project Name: ${projectName}`,
    `Release Type: ${releaseType}`,
    `Version: ${version}`,
    `PR Label(Optional): ${Utils.isNullOrEmptyOrUndefined(prLabel) ? "Not Provided" : prLabel}}`,
    `GitHub Token(Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}}`,
]);

// Check the release type and make sure that it is all lowercase except the first letter
const allButFirstLetter = releaseType.slice(1).toLowerCase();
const firstLetter = releaseType.slice(0, 1).toUpperCase();
releaseType = `${firstLetter}${allButFirstLetter}`;

if (releaseType != "Production" && releaseType != "Preview") {
    console.log(`::error::The release type '${releaseType}' is invalid.  It must be either 'Production' or 'Preview'.`);
    Deno.exit(1);
}

// Make sure the version starts with a 'v'
version = version.startsWith("v") ? version : `v${version}`;

const noPRLabel: boolean = Utils.isNullOrEmptyOrUndefined(prLabel);
const prLabelGiven: boolean = !noPRLabel;

const problemsFound: string[] = [];

// Check that the label exists
if (prLabelGiven) {
    const labelClient: LabelClient = new LabelClient(token);
    const labelExists: boolean = await labelClient.labelExists(projectName, prLabel);

    if (!labelExists) {
        problemsFound.push(`The label '${prLabel}' does not exist in the project '${projectName}'.`);
    }
}

const issueLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/issues\/[0-9]*\)/gm;
const prLinkRegex = /\[#[0-9]*\]\(https:\/\/github\.com\/KinsonDigital\/[a-zA-z]*\/pull\/[0-9]*\)/gm;
const title = new RegExp(`${projectName} ${releaseType} Release Notes - ${version}`, "gm");

const milestoneClient = new MilestoneClient();
const issues = await milestoneClient.getIssues(projectName, version);
const prs = await milestoneClient.getPullRequests(projectName, version);

const pullRequests = noPRLabel ? [] : prs.filter(pr => pr.labels.includes(prLabel));

const releaseNotesFilePath: string = `${Deno.cwd()}/cicd/test-release-notes.md`;
const releaseNoteFileData: string = File.LoadFile(releaseNotesFilePath);
const issueLinks: string[] = releaseNoteFileData.match(issueLinkRegex) ?? [];
const prLinks: string[] = noPRLabel ? [] : releaseNoteFileData.match(prLinkRegex) ?? [];

// If the title is incorrect, add to the list of errors found
if (releaseNoteFileData.match(title) === null) {
    problemsFound.push(`The title of the release notes is incorrect.  It should be '${projectName} ${releaseType} Release Notes - ${version}'.`);
}

// Check that all of the issues exist in the release notes
issues.forEach(issue => {
    const issueLink: string = `[#${issue.number}](${issue.html_url})`;

    if (!issueLinks.includes(issueLink)) {
        problemsFound.push(`The issue link for issue '${issue.number}' does not exist in the release notes.`);
    }
});

pullRequests.forEach(pr => {
    const prLink: string = `[#${pr.number}](${pr.html_url})`;

    if (!prLinks.includes(prLink)) {
        problemsFound.push(`The pr link for issue '${pr.number}' with the label '${prLabel}' does not exist in the release notes.`);
    }
});

Utils.printProblemList(problemsFound).then(() => {
    console.log("✅No problems found!!  Release notes are valid.✅");
}).catch((error) => {
    Utils.printAsGitHubError(error);
    Deno.exit(1);
});

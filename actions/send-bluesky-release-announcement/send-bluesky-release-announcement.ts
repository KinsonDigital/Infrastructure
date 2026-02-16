import { AppBskyFeedPost, AtpAgent, RichText } from "npm:@atproto/api@0.18.21";
import { RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { existsSync } from "jsr:@std/fs@1.0.22";
import { getEnvVar, isNotValidPreviewVersion, isNotValidProdVersion } from "../../cicd/core/Utils.ts";
import { isNothing } from "../../cicd/core/guards.ts";
import { validateOrgExists, validateRepoExists } from "../../cicd/core/Validators.ts";
import { printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const projectName = (Deno.env.get("PROJECT_NAME") ?? "").trim();
let version = getEnvVar("VERSION", scriptFileName).toLowerCase();
const websiteUrl = (Deno.env.get("WEBSITE_URL") || "").trim(); // Optional
const templateRepoName = (Deno.env.get("POST_TEMPLATE_REPO_NAME") ?? "").trim(); // Optional
const templateBranchName = (Deno.env.get("POST_TEMPLATE_BRANCH_NAME") ?? "").trim(); // Optional
const relativeTemplateFilePath = (Deno.env.get("POST_TEMPLATE_REPO_RELATIVE_FILE_PATH") ?? "").trim(); // Optional
const localPostTemplateFilePath = (Deno.env.get("LOCAL_POST_TEMPLATE_FILE_PATH") ?? "").trim(); // Optional
const service = getEnvVar("SERVICE", scriptFileName);
const identifier = getEnvVar("IDENTIFIER", scriptFileName);
const password = getEnvVar("PASSWORD", scriptFileName);
const discordInviteCode = (Deno.env.get("DISCORD_INVITE_CODE") ?? "").trim(); // Optional
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

version = version.startsWith("v") ? version : `v${version}`;

// Print info about the available template variables for use
const tempVarsInfoMsg = `The following template variables are available for use in the release announcement post template:` +
	"\n\tPROJECT_NAME" +
	"\n\tVERSION" +
	"\n\tWEBSITE_URL" +
	"\n\tNUGET_VERSION" +
	"\n\tREPO_OWNER" +
	"\n\tDISCORD_INVITE_CODE";
printAsGitHubNotice(tempVarsInfoMsg);

// If the local post template file path is not provided, and the repository inputs are provided
const getTemplateFromRemoteRepo = isNothing(localPostTemplateFilePath) &&
	!isNothing(templateRepoName) && !isNothing(templateBranchName) && !isNothing(relativeTemplateFilePath);

const getTemplateFromLocalFile = !isNothing(localPostTemplateFilePath);

await validateOrgExists(ownerName, token);

if (getTemplateFromRemoteRepo) {
	await validateRepoExists(ownerName, templateRepoName, token);
}

if (isNotValidPreviewVersion(version) && isNotValidProdVersion(version)) {
	let errorMsg = `The version '${version}' is not a valid preview or production version.`;
	errorMsg += "\nRequired Syntax: v#.#.# or v#.#.#-preview.#";
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

let templateFileData = "";

if (getTemplateFromRemoteRepo) {
	const repoClient = new RepoClient(ownerName, templateRepoName, token);

	const templateDoesNotExist = !(await repoClient.fileExists(templateBranchName, relativeTemplateFilePath));

	if (templateDoesNotExist) {
		printAsGitHubError(`The release Bluesky post template file '${relativeTemplateFilePath}' could not be found.`);
		Deno.exit(1);
	}

	templateFileData = await repoClient.getFileContent(templateBranchName, relativeTemplateFilePath);
} else if (getTemplateFromLocalFile) {
	// Check if the local file does not exist
	if (!existsSync(localPostTemplateFilePath)) {
		const errorMsg = `The local release Bluesky post template file '${localPostTemplateFilePath}' could not be found.` +
			"\nPlease ensure that the repository is checked out, the file exists at the specified path, or provide valid repository template inputs.";
		printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	templateFileData = await Deno.readTextFile(localPostTemplateFilePath);
} else {
	const errorMsg = "Missing required inputs for the release announcement post template." +
		"\nPlease provide either the 'local-post-template-file-path' input value or all of the " +
		"('post-template-repo-name', 'post-template-branch-name', 'post-template-repo-relative-file-path') input values." +
		"\nThe 'local-post-template-file-path' input takes precedence over the repository template inputs.";
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

if (isNothing(templateFileData)) {
	printAsGitHubError("The release announcement post template file is empty.");
	Deno.exit(1);
}

const nugetVersion = version.startsWith("v") ? version.replace("v", "") : version;

const post = templateFileData.replaceAll(`{PROJECT_NAME}`, projectName)
	.replaceAll(`{VERSION}`, version)
	.replaceAll("{WEBSITE_URL}", websiteUrl)
	.replaceAll(`{NUGET_VERSION}`, nugetVersion)
	.replaceAll(`{REPO_OWNER}`, ownerName)
	.replaceAll(`{DISCORD_INVITE_CODE}`, discordInviteCode);

const agent = new AtpAgent({ service });

await agent.login({ identifier, password });

const richText = new RichText({
	text: post,
});

await richText.detectFacets(agent);

if (richText.graphemeLength > 300) {
	printAsGitHubError(
		`The length of the release announcement post (${richText.graphemeLength} graphemes) exceeds the maximum allowed length of 300 graphemes for a Bluesky post.` +
			`\nPlease shorten the post content to fit within the limit. The post content after template variable replacement is:\n${post}`,
	);

	Deno.exit(1);
}

const postRecord: AppBskyFeedPost.Record = {
	$type: "app.bsky.feed.post",
	text: richText.text,
	facets: richText.facets,
	createdAt: new Date().toISOString(),
};

const postResult = await agent.post(postRecord);

printAsGitHubNotice(
	`A release Bluesky post was successfully broadcasted for the '${projectName}' project for version '${version}'.`,
);
printAsGitHubNotice(`\tPost URI: ${postResult.uri}`); // Indicates the repository DID, collection, and record key
printAsGitHubNotice(`\tPost CID: ${postResult.cid}`); // A hash of the record itself

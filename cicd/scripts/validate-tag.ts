import { TagClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { getEnvVar, isNotValidPreviewVersion, isNotValidProdVersion } from "../core/Utils.ts";
import { validateOrgExists, validateRepoExists } from "../core/Validators.ts";
import { printAsGitHubError } from "../core/github.ts";

type ReleaseType = "production" | "preview";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName: string = getEnvVar("OWNER_NAME", scriptFileName);
const repoName: string = getEnvVar("REPO_NAME", scriptFileName);
const releaseType = <ReleaseType> getEnvVar("RELEASE_TYPE", scriptFileName).toLowerCase();
let tag: string = getEnvVar("TAG_NAME", scriptFileName);
tag = tag.startsWith("v") ? tag : `v${tag}`;
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

const releaseTypeInvalid = releaseType != "production" && releaseType != "preview";

if (releaseTypeInvalid) {
	const errorMsg = `The tag type argument '${releaseType}' is invalid.  Valid values are 'production', 'preview' or 'either'.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const tagIsInvalid = releaseType === "production" ? isNotValidProdVersion(tag) : isNotValidPreviewVersion(tag);

if (tagIsInvalid) {
	const tagTypeStr = releaseType === "production" || releaseType === "preview" ? releaseType : "production or preview";

	printAsGitHubError(`The tag is not in the correct ${tagTypeStr} version syntax.`);
	Deno.exit(1);
}

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

const tagClient: TagClient = new TagClient(ownerName, repoName, token);

const tagExists = await tagClient.exists(tag);

if (tagExists) {
	printAsGitHubError(`The tag '${tag}' already exists.`);
	Deno.exit(1);
}

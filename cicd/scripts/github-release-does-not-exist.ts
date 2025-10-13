import { ReleaseClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import getEnvVar from "../core/GetEnvVar.ts";
import { isNotValidPreviewVersion, isNotValidProdVersion } from "../core/Utils.ts";
import { validateOrgExists, validateRepoExists } from "../core/Validators.ts";
import { printAsGitHubError } from "../core/github.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const tagName = getEnvVar("TAG_NAME", scriptFileName);
const githubToken = getEnvVar("GITHUB_TOKEN", scriptFileName);

// Validate the tag
if (isNotValidProdVersion(tagName) && isNotValidPreviewVersion(tagName)) {
	const errorMsg =
		`The tag name '${tagName}' is not a valid tag name.  The tag name must be a valid production or preview version.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

const releaseClient: ReleaseClient = new ReleaseClient(ownerName, repoName, githubToken);

const releaseExists = await releaseClient.releaseExists(tagName);

if (releaseExists) {
	const errorMsg = `A release for the tag '${tagName}' already exists.` +
		"\nIs the tag provided the incorrect tag?";

	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

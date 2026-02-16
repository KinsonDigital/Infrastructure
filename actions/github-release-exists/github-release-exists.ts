import { ReleaseClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import { printAsGitHubError, setGitHubOutput } from "../../cicd/core/github.ts";
import { getEnvVar, isNotValidPreviewVersion, isNotValidProdVersion } from "../../cicd/core/Utils.ts";
import { validateOrgExists, validateRepoExists } from "../../cicd/core/Validators.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const outputName = "release-exists";
const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const tagName = getEnvVar("TAG_NAME", scriptFileName);
const failIfExists = getEnvVar("FAIL_IF_EXISTS", scriptFileName).toLowerCase() === "true";
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

await validateOrgExists(ownerName, token);
await validateRepoExists(ownerName, repoName, token);

// Validate the tag
if (isNotValidProdVersion(tagName) && isNotValidPreviewVersion(tagName)) {
	const errorMsg =
		`The tag name '${tagName}' is not a valid tag name.  The tag name must be a valid production or preview version.`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const releaseClient: ReleaseClient = new ReleaseClient(ownerName, repoName, token);

const releaseExists = await releaseClient.releaseExists(tagName);

setGitHubOutput(outputName, releaseExists ? "true" : "false");

if (failIfExists && releaseExists) {
	const errorMsg = `A release for the tag '${tagName}' already exists.` +
		"\nIs the tag provided an incorrect tag?";

	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

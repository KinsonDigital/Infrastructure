import { ReleaseClient } from "../../deps.ts";
import getEnvVar from "../core/GetEnvVar.ts";
import { Utils } from "../core/Utils.ts";
import { validateOrgExists, validateRepoExists } from "../core/Validators.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const tagName = getEnvVar("TAG_NAME", scriptFileName);
const githubToken = getEnvVar("GITHUB_TOKEN", scriptFileName);

// Validate the tag
if (Utils.isNotValidProdVersion(tagName) && Utils.isNotValidPreviewVersion(tagName)) {
	const errorMsg = `The tag name '${tagName}' is not a valid tag name.  The tag name must be a valid production or preview version.`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

await validateOrgExists(scriptFileName);
await validateRepoExists(scriptFileName);

const releaseClient: ReleaseClient = new ReleaseClient(ownerName, repoName, githubToken);

const releaseExists = await releaseClient.releaseExists(tagName);

if (releaseExists) {
	const errorMsg = `A release for the tag '${tagName}' already exists.` + 
		"\nIs the tag provided the incorrect tag?";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

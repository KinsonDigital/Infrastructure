import { ReleaseClient } from "../clients/ReleaseClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

// Validate the arguments
if (Deno.args.length < 2) {
	let errorMsg = `The '${scriptName}' cicd script must have at least 2 arguments and 1 optional argument.`;
	errorMsg += "\nThe 1st arg is required and must be a the name of the repository.";
	errorMsg += "\nThe 2nd arg is required and must be the name of the tag for the release.";
	errorMsg += "\nThe 2nd arg is optional and must be a valid GitHub token with the required permissions.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const tagName = Deno.args[1].trim();
const githubToken = Deno.args.length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Repository Name (Required): ${repoName}`,
	`Tag Name (Required): ${tagName}`,
	`GitHub Token (Optional): ${githubToken}`,
]);

// Validate the tag
if (Utils.isNotValidProdVersion(tagName) && Utils.isNotValidPreviewVersion(tagName)) {
	Utils.printAsGitHubError(
		`The tag name '${tagName}' is not a valid tag name.  The tag name must be a valid production or preview version.`,
	);
	Deno.exit(1);
}

const releaseClient: ReleaseClient = new ReleaseClient(githubToken);

const releaseExists = await releaseClient.releaseExists(repoName, tagName);

if (releaseExists) {
	let errorMsg = `A release for the tag '${tagName}' already exists.`;
	errorMsg += "\nIs the tag provided the incorrect tag?";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

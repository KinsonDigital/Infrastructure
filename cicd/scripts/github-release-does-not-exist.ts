import { ReleaseClient } from "../../deps.ts";
import { Utils } from "../core/Utils.ts";

const githubReleaseDoesNotExistExecutor = async () => {
	// Validate the arguments
	if (Deno.args.length != 3) {
		let errorMsg = `The cicd script must have 4 arguments but has ${Deno.args.length} argument(s).`;
		errorMsg += "\nThe 1st arg is required and must be a the name of the repository owner.";
		errorMsg += "\nThe 2nd arg is required and must be a the name of the repository.";
		errorMsg += "\nThe 3rd arg is required and must be the name of the tag for the release.";
		errorMsg += "\nThe 4th arg is required and must be a GitHub PAT (Personal Access Token).";

		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	const ownerName = Deno.args[1].trim();
	const repoName = Deno.args[1].trim();
	const tagName = Deno.args[2].trim();
	const githubToken = Deno.args.length >= 4 ? Deno.args[4].trim() : "";

	// Print out all of the arguments
	Utils.printInGroup("Script Arguments", [
		`Repo Owner (Required): ${repoName}`,
		`Repository Name (Required): ${repoName}`,
		`Tag Name (Required): ${tagName}`,
		`GitHub Token (Required): ${githubToken}`,
	]);

	// Validate the tag
	if (Utils.isNotValidProdVersion(tagName) && Utils.isNotValidPreviewVersion(tagName)) {
		Utils.printAsGitHubError(
			`The tag name '${tagName}' is not a valid tag name.  The tag name must be a valid production or preview version.`,
		);
		Deno.exit(1);
	}

	const releaseClient: ReleaseClient = new ReleaseClient(ownerName, repoName, githubToken);

	const releaseExists = await releaseClient.releaseExists(tagName);

	if (releaseExists) {
		let errorMsg = `A release for the tag '${tagName}' already exists.`;
		errorMsg += "\nIs the tag provided the incorrect tag?";

		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	}
};

githubReleaseDoesNotExistExecutor();

export default githubReleaseDoesNotExistExecutor;

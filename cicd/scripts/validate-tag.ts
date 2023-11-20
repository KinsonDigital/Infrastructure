import { RepoClient, TagClient } from "../../deps.ts";
import { Utils } from "../core/Utils.ts";

// Validate the arguments
if (Deno.args.length != 5) {
	let errorMsg = `The cicd script must have 4 arguments but has ${Deno.args.length} argument(s).`;
	errorMsg += "\nThe 1st arg is required and must be a valid GitHub repository owner name.";
	errorMsg += "\nThe 2nd arg is required and must be a valid GitHub repo.";
	errorMsg += "\nThe 3rd arg is required and must be either 'production', 'preview' or 'either'.";
	errorMsg += "\nThe 4th arg is required and must be the name of the tag.";
	errorMsg += "\nThe 5th arg is required and must be a GitHub PAT (Personal Access Token).";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const ownerName: string = Deno.args[0];
const repoName: string = Deno.args[1];
const tagType: string = Deno.args[2].toLowerCase();
let tag: string = Deno.args[3].trim();
tag = tag.startsWith("v") ? tag : `v${Deno.args[3]}`;
const token = Deno.args.length >= 5 ? Deno.args[4].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Owner Name (Required): ${ownerName}`,
	`Repo Name (Required): ${repoName}`,
	`Tag Type (Required): ${tagType}`,
	`Tag (Required): ${tag}`,
	`GitHub Token (Required): ${Utils.isNothing(token) ? "Not Provided" : "****"}`,
]);

const versionTypeInvalid = tagType != "production" && tagType != "preview" && tagType != "either";

if (versionTypeInvalid) {
	Utils.printAsGitHubError(
		`The tag type argument '${tagType}' is invalid.  Valid values are 'production', 'preview' or 'either'.`,
	);
	Deno.exit(1);
}

let tagIsInvalid = false;

switch (tagType) {
	case "production":
		tagIsInvalid = Utils.isNotValidProdVersion(tag);
		break;
	case "preview":
		tagIsInvalid = Utils.isNotValidPreviewVersion(tag);
		break;
	case "either":
		tagIsInvalid = Utils.isNotValidProdVersion(tag) || Utils.isNotValidPreviewVersion(tag);
		break;
	default:
		break;
}

if (tagIsInvalid) {
	const tagTypeStr = tagType === "production" || tagType === "preview" ? tagType : "production or preview";

	Utils.printAsGitHubError(`The tag is not in the correct ${tagTypeStr} version syntax.`);
	Deno.exit(1);
}

const repoClient: RepoClient = new RepoClient(ownerName, repoName, token);
const repoDoesNotExist = !(await repoClient.exists());

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const tagClient: TagClient = new TagClient(ownerName, repoName, token);

const tagExists = await tagClient.tagExists(tag);

if (tagExists) {
	Utils.printAsGitHubError(`The tag '${tag}' already exists.`);
	Deno.exit(1);
}

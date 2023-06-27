import { ITagModel } from "../core/Models/ITagModel.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { TagClient } from "../clients/TagClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

// Validate the arguments
if (Deno.args.length < 3) {
	let errorMsg = `The '${scriptName}' cicd script must have 3 arguments and with an additional 1 optional argument.`;
	errorMsg += "\nThe 1st arg is required and must be a valid GitHub repo.";
	errorMsg += "\nThe 2nd arg is required and must be either 'production', 'preview' or 'either'.";
	errorMsg += "\nThe 3rd arg is required and must be the name of the tag.";
	errorMsg += "\nThe 4th arg is optional and must be a GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const repoName: string = Deno.args[0];
const tagType: string = Deno.args[1].toLowerCase();
let tag: string = Deno.args[2].trim();
tag = tag.startsWith("v") ? tag : `v${Deno.args[2]}`;
const token = Deno.args.length >= 4 ? Deno.args[3].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Script Arguments", [
	`Repo Name (Required): ${repoName}`,
	`Tag Type (Required): ${tagType}`,
	`Tag (Required): ${tag}`,
	`GitHub Token (Optional): ${Utils.isNullOrEmptyOrUndefined(token) ? "Not Provided" : "****"}`,
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

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const tagClient: TagClient = new TagClient(token);

const tagExists = await tagClient.tagExists(repoName, tag);

if (tagExists) {
	Utils.printAsGitHubError(`The tag '${tag}' already exists.`);
	Deno.exit(1);
}

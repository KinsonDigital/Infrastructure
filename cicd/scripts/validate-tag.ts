import { ITagModel } from "../core/Models/ITagModel.ts";
import { RepoClient } from "../clients/RepoClient.ts";
import { TagClient } from "../clients/TagClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();

// Validate the arguments
if (Deno.args.length < 2) {
	let errorMsg = `The '${scriptName}' cicd script must have 3 arguments and with an additional 1 optional argument.`;
	errorMsg += "\nThe 1st arg is required and must be either 'production', 'preview' or 'either'.";
	errorMsg += "\nThe 2nd arg is required and must be the name of the tag.";
	errorMsg += "\nThe 3rd arg is optional and must be a GitHub token.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const tagType: string = Deno.args[0].toLowerCase();
const tag: string = Deno.args[1].startsWith("v") ? Deno.args[1] : `v${Deno.args[1]}`;
const repoName: string = Deno.args[2];
const token = Deno.args[2].length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
	`Tag Type (Required): ${tagType}`,
	`Tag (Required): ${tag}`,
	`Repo Name (Required): ${repoName}`,
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

	console.log(`The tag is not in the correct ${tagTypeStr} version syntax.`);
	Deno.exit(1);
}

const repoClient: RepoClient = new RepoClient(token);
const repoDoesNotExist = !(await repoClient.repoExists(repoName));

if (repoDoesNotExist) {
	Utils.printAsGitHubError(`The repository '${repoName}' does not exist.`);
	Deno.exit(1);
}

const tagClient: TagClient = new TagClient(token);

const tags: ITagModel[] = await tagClient.getTags(repoName);

const tagNames: string[] = tags.map((t) => t.name);

const tagExists = tagNames.some((t) => t === tag);

if (tagExists) {
	console.log(`The tag '${tag}' already exists.`);
	Deno.exit(1);
}

import { ITagModel } from "../core/Models/ITagModel.ts";
import { RepoClient } from "../core/RepoClient.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { TagClient } from "../core/TagClient.ts";
import { Utils } from "../core/Utils.ts";

const scriptName = Utils.getScriptName();
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

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

if (tagType != "production" && tagType != "preview" && tagType != "either") {
	let errorMsg = "The tag type argument must be a value of 'production', 'preview' or 'either'.";
	errorMsg += "\nThe value is case-insensitive.";

	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const prodVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
const prevVersionRegex = /^v[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$/;

let isValid = false;

switch (tagType) {
	case "production":
		isValid = prodVersionRegex.test(tag);
		break;
	case "preview":
		isValid = prevVersionRegex.test(tag);
		break;
	case "either":
		isValid = prodVersionRegex.test(tag) || prevVersionRegex.test(tag);
		break;
	default:
		break;
}

if (isValid === false) {
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

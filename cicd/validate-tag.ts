import { ITagModel } from "./core/Models/ITagModel.ts";
import { ScriptDescriptions } from "./core/ScriptDescriptions.ts";
import { TagClient } from "./core/TagClient.ts";
import { Utils } from "./core/Utils.ts";

const scriptName = Utils.getScriptName()
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

// Validate the arguments
if (Deno.args.length >= 3 && Deno.args.length <= 4) {
    let errorMsg = `The '${scriptName}' cicd script must have two arguments.`;
    errorMsg += "\nThe 1st arg must be either 'production', 'preview' or 'either'.";
    errorMsg += "\nThe 2nd arg must be the name of the tag.";
    errorMsg += "\nThe 3rd arg is optional and must be a GitHub token.";

    console.log(`::error::${errorMsg}`);
    Deno.exit(1);
}

const tagType: string = Deno.args[0].toLowerCase();
const tag: string = Deno.args[1].startsWith("v") ? Deno.args[1] : `v${Deno.args[1]}`;
const projectName: string = Deno.args[2];
const token = Deno.args[2].length >= 3 ? Deno.args[2].trim() : "";

// Print out all of the arguments
Utils.printInGroup("Arguments", [
    `Tag Type: ${tagType}`,
    `Tag: ${tag}`,
    `Project Name: ${projectName}`,
]);

if (tagType != "production" && tagType != "preview" && tagType != "either") {
    let errorMsg = "The tag type argument must be a value of 'production', 'preview' or 'either'.";
    errorMsg += "\nThe value is case-insensitive.";

    console.log(`::error::${errorMsg}`);
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
    const tagTypeStr = tagType === "production" || tagType === "preview"
    ? tagType
    : "production or preview";
    
    console.log(`The tag is not in the correct ${tagTypeStr} version syntax.`);
    Deno.exit(1);
}
 

const tagClient: TagClient = new TagClient(token);

const tags: ITagModel[] = await tagClient.getTags(projectName);

const tagNames: string[] = tags.map(t => t.name);

const tagExists: boolean = tagNames.some(t => t === tag);

if (tagExists) {
    console.log(`The tag '${tag}' already exists.`);
    Deno.exit(1);
}

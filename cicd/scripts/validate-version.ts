import { Utils } from "../core/Utils.ts";

const validateVersionExecutor = () => {
	// Validate the arguments
	if (Deno.args.length != 2) {
		let errorMsg = `The cicd script must have 2 arguments but has ${Deno.args.length} argument(s).`;
		errorMsg += "\nThe 1st arg is required and must be a production or preview version.";

		errorMsg +=
			"\nThe 2nd arg is required and must be the version type.  Valid values are 'production', 'preview' or 'either'.";
		errorMsg += "\n\tThe production version syntax is as follows: v<major>.<minor>.<patch>";
		errorMsg += "\n\tThe preview version syntax is as follows: v<major>.<minor>.<patch>-preview.<preview number>";

		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	}

	let version: string = Deno.args[0].toLowerCase();
	version = version.startsWith("v") ? version : `v${version}`;

	const versionType: string = Deno.args[1].toLowerCase();

	const versionTypeInvalid = versionType != "production" && versionType != "preview" && versionType != "either";

	if (versionTypeInvalid) {
		Utils.printAsGitHubError(
			`The version type argument '${versionType}' is invalid.  Valid values are 'production', 'preview' or 'either'.`,
		);
		Deno.exit(1);
	}

	// Print out all of the arguments
	Utils.printInGroup("Script Arguments", [
		`Version (Required): ${version}`,
		`Version Type (Required): ${versionType}`,
	]);

	let versionIsInvalid = false;

	switch (versionType) {
		case "production":
			versionIsInvalid = Utils.isNotValidProdVersion(version);
			break;
		case "preview":
			versionIsInvalid = Utils.isNotValidPreviewVersion(version);
			break;
		case "either":
			versionIsInvalid = Utils.isNotValidProdVersion(version) || Utils.isNotValidPreviewVersion(version);
			break;
		default:
			break;
	}

	if (versionIsInvalid) {
		const tagTypeStr = version === "production" || version === "preview" ? version : "production or preview";

		let errorMsg = `\nThe version is not in the correct ${tagTypeStr} version syntax.`;
		errorMsg += "\n\tThe production version syntax is as follows: v<major>.<minor>.<patch>";
		errorMsg += "\n\tThe preview version syntax is as follows: v<major>.<minor>.<patch>-preview.<preview number>";

		Utils.printAsGitHubError(errorMsg);
		Deno.exit(1);
	} else {
		Utils.printAsGitHubNotice(`✅The ${versionType} version '${version}' is valid!!✅`);
	}
};

validateVersionExecutor();
export default validateVersionExecutor;

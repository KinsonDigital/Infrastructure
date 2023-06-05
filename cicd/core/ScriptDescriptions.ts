import { extname, resolve } from "https://deno.land/std@0.190.0/path/mod.ts";
import { File } from "./File.ts";
import { Utils } from "./Utils.ts";

/**
 * Loads the description text file for a script.
 */
export class ScriptDescriptions {
	/**
	 * Prints the description for a script tha matches the given {@link scriptName}.
	 * @param scriptName The name of the script to get the description for.
	 */
	public printScriptDescription(scriptName: string): void {
		const extension: string = extname(scriptName);
		const descriptionFileName: string = scriptName.replace(extension, ".txt");
		const scriptDescription: string = this.getScriptDescription(descriptionFileName);

		console.log(`::group::Script Info`);

		if (Utils.isNullOrEmptyOrUndefined(scriptDescription)) {
			console.log(`::warning::A script description file was not found for the script '${scriptName}'.`);
		} else {
			console.log(scriptDescription);
		}

		console.log("::endgroup::");
	}

	/**
	 * Gets the description for the given script that matches the given {@link scriptName}.
	 * @param scriptName The name of the script to get the description for.
	 */
	private getScriptDescription(scriptName: string): string {
		const baseDirPath = `${Deno.cwd()}/scripts/script-descriptions`;

		const descriptionFiles: string[] = [];
		const items = Deno.readDirSync(baseDirPath);

		for (const item of items) {
			if (item.isFile) {
				descriptionFiles.push(resolve(baseDirPath, item.name));
			}
		}

		const filePath: string = descriptionFiles.find((filePath) => filePath.endsWith(`${scriptName}`)) ?? "";

		if (filePath == "") {
			return "";
		} else {
			const fileData: string = File.LoadFile(filePath);

			return fileData;
		}
	}
}

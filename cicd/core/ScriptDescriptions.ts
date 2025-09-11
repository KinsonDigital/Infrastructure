import { extname, resolve } from "@std/path";
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

		if (Utils.isNothing(scriptDescription)) {
			Utils.printAsGitHubWarning(`::warning::A script description file was not found for the script '${scriptName}'.`);
		} else {
			Utils.printInGroup("Script Info", scriptDescription);
		}
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

		if (filePath === "") {
			return "";
		} else {
			const fileData: string = Deno.readTextFileSync(filePath);

			return fileData;
		}
	}
}

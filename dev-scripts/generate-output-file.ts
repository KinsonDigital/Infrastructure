import { existsSync } from "jsr:@std/fs@1.0.19";

let filePath = Deno.args[0];

if (filePath === undefined) {
	console.error("The output file path argument was not provided to the 'Generate Output File' task in the 'tasks.json' file.");
	Deno.exit(1);
}

filePath = filePath.trim();

if (existsSync(filePath)) {
	Deno.removeSync(filePath);
}

Deno.writeTextFileSync(filePath, "");

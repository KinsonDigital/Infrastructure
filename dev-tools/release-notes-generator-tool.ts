import { Confirm, Input, Select } from "jsr:@cliffy/prompt@1.0.0-rc.8";
import { walkSync } from "jsr:@std/fs@1.0.19";
import { printError, printInfo, printStatusUpdate, printStep } from "./core/console-msgs.ts";
import { GeneratorSettings } from "./core/generator-settings.ts";
import { ReleaseNotesGenerator } from "./core/release-notes-generator.ts";
import { existsSync } from "node:fs";

const settingsFileName = "release-notes-generator-settings.json";

printStep("Welcome to the Release Notes Generator Tool!");
printStatusUpdate(`Searching for the settings file '${settingsFileName}'.`);

const fileNameRegex = new RegExp(settingsFileName);
const settingFilePaths = Array.from(walkSync("./", { includeFiles: true, match: [fileNameRegex] })).map((entry) => entry.path);

if (settingFilePaths.length <= 0) {
	let stopTool = false;
	const createFile = await Confirm.prompt({
		message: "No settings file found. Would you like to create a settings file?",
	});

	if (createFile) {
		printStatusUpdate("Creating an empty settings file");
		const settings: GeneratorSettings & { $schema: string } = {
			$schema:
				"https://raw.githubusercontent.com/EngagedAgility/Infrastructure/preview/dev-tools/release-notes-settings-schema.json",
			ownerName: "",
			repoName: "",
			githubTokenEnvVarName: "",
			milestoneName: "",
			headerText: "",
			chosenReleaseType: "",
			relativeReleaseNotesDirPath: "",
			releaseTypeNames: [],
			emojisToRemoveFromTitle: [],
			issueCategoryIssueTypeMappings: {},
			issueCategoryLabelMappings: {},
			prCategoryLabelMappings: {},
			ignoreLabels: [],
			wordReplacements: {},
			firstWordReplacements: {},
			boldedVersions: true,
			italicVersions: true,
			otherCategoryName: "",
			styleWordsList: {},
			extraInfo: {
				text: "",
				title: "",
			},
		};

		const settingJsonData = JSON.stringify(settings, null, 4);

		try {
			const settingsFilePath = `${Deno.cwd()}/${settingsFileName}`;
			Deno.writeTextFileSync(settingsFilePath, settingJsonData);

			printInfo(`Created an empty settings file at '${settingsFilePath}'.`, 2);
			printInfo("Fill out the settings and then rerun the tool.", 2);
			stopTool = true;
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			printError(errMsg);
			stopTool = true;
		}
	} else {
		printInfo("Cannot run the tool without a settings file. Stopping the tool.");
		stopTool = true;
	}

	if (stopTool) {
		Deno.exit();
	}
} else {
	printInfo(`Found the settings file at '${settingFilePaths[0]}'.`, 2);
}

printStatusUpdate("Loading the settings file.");

const settingsFilePath = settingFilePaths[0];
const settingsJsonData = Deno.readTextFileSync(settingsFilePath);
const settings = JSON.parse(settingsJsonData) as GeneratorSettings;
const releaseTypeNames = settings.releaseTypeNames.map((name) => name.trim()).filter((name) => name !== "");

if (releaseTypeNames.length <= 0) {
	printError("The 'releaseTypeNames' setting is required to have at least one item.");
	Deno.exit(0);
}

// Ask for which release type to use
const chosenReleaseType = releaseTypeNames.length === 1 ? releaseTypeNames[0] : await Select.prompt({
	message: "Select the release type:",
	options: releaseTypeNames,
	transform: (value) => value.trim(),
});

settings.chosenReleaseType = chosenReleaseType;

// Ask for the version the release is for
const version = await Input.prompt({
	message: "Enter the version for the release:",
	validate: (value) => {
		const regex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)(-preview\.([1-9]\d*))?$/gm;

		return regex.test(value)
			? true
			: "The version must be in the format 'vX.Y.Z' or 'vX.Y.Z-preview.N', where X, Y, Z, and N are non-negative integers and X is not prefixed by a zero.";
	},
	transform: (value) => value.trim(),
});

settings.version = version;

printStatusUpdate("Generating the release notes.");
const notesGenerator = new ReleaseNotesGenerator();
const releaseNotes = await notesGenerator.generateNotes(settings);

try {
	printStatusUpdate("Validating the relative release notes directory path");

	const relativeReleaseNotesDirPath = settings.relativeReleaseNotesDirPath.trim();

	if (relativeReleaseNotesDirPath === "") {
		printError(
			"The 'relativeReleaseNotesDirPath' setting is not set. Please set it to the path where the release notes should be saved.",
		);
		Deno.exit();
	}

	if (!existsSync(relativeReleaseNotesDirPath)) {
		printError(
			`The relative release notes directory path '${settings.relativeReleaseNotesDirPath}' does not exist. Please create the directory or update the setting to point to an existing directory.`,
		);
		Deno.exit();
	}

	const dirPath = relativeReleaseNotesDirPath.endsWith("/")
		? `${relativeReleaseNotesDirPath.replace(/\/+$/, "")}/${chosenReleaseType}-releases`
		: `${relativeReleaseNotesDirPath}/${chosenReleaseType}-releases`;
	const fileName = `Release-Notes-${version}.md`;
	const fullPath = `${dirPath}/${fileName}`;

	Deno.writeTextFileSync(fullPath, releaseNotes);
	printStep(`The release notes have been generated and written to '${settingFilePaths[0]}'.`);
} catch (error) {
	const errMsg = error instanceof Error ? error.message : String(error);
	printError(errMsg);
}

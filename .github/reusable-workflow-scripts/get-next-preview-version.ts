/**
 * DESCRIPTION:
 * Validates that the environment variable PREVIEW_VERSION exists and is in the correct format,
 * which is 'vX.Y.Z-preview.N' where X, Y, Z, and N are non-negative integers.
 * 
 * Then extracts the preview number from the PREVIEW_VERSION and checks if it is a valid integer
 * and returns the original preview version with the preview number incremented by 1.
 */

import { printAsGitHubError, setGitHubOutput } from "../../cicd/core/github.ts";

const previewVersion = (Deno.env.get("PREVIEW_VERSION") || "").trim();

const prevVersionRegex = /^v([1-9]\d*|0)\.([1-9]\d*|0)\.([1-9]\d*|0)-preview\.([1-9]\d*)$/;

if (previewVersion === "") {
	console.log("::error::Missing required environment variable: PREVIEW_VERSION");

	Deno.exit(1);
}

if (!prevVersionRegex.test(previewVersion)) {
	const errorMsg = `::error::Invalid preview version format: ${previewVersion}. Must be in the format of 'vX.Y.Z-preview.N'`;
	printAsGitHubError(errorMsg);

	Deno.exit(1);
}

// Remove the 'v' prefix if it exists
const trimmedPreviewVersion = previewVersion.at(0) === "v" ? previewVersion.slice(1) : previewVersion;
const leftSectionParts = trimmedPreviewVersion.split("-")[0];

const major: number = parseInt(leftSectionParts[0], 10);
const minor: number = parseInt(leftSectionParts[1], 10);
const patch: number = parseInt(leftSectionParts[2], 10);

const rightSectionParts = trimmedPreviewVersion.split("-")[1].split(".");
const previewNumber: number = parseInt(rightSectionParts[1], 10);

const newPreviewVersion = `v${major}.${minor}.${patch}-preview.${previewNumber + 1}`;

try {
	setGitHubOutput("next-preview-version", newPreviewVersion);
} catch (error) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	printAsGitHubError(`An error occurred while processing the preview version: ${errorMsg}`);
	Deno.exit(1);
}

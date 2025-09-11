import { Utils } from "./Utils.ts";

/**
 * Checks if the value is null, undefined, or empty.
 * @param value The value to check.
 * @returns True if the value is null, undefined, or empty, otherwise false.
 */
export function isNothing<T>(
	value: undefined | null | string | number | boolean | T[] | (() => T) | object,
	funcName = "",
	paramName = "",
): void {
	let type: string | undefined = undefined;
	let errorMsg = `The {{TYPE}} value is null, undefined, or empty.`;

	if (value === undefined || value === null) {
		type = "value";
	}

	if (typeof value === "string") {
		type = "string";
	}

	if (Array.isArray(value)) {
		type = "array";
	}

	if (type === undefined) {
		return;
	}

	errorMsg = errorMsg.replace("{{TYPE}}", type);

	if (funcName !== "") {
		errorMsg += `\nFunction Name: ${funcName}`;
	}

	if (paramName !== "") {
		errorMsg += `\nParam Name: ${paramName}`;
	}

	Utils.printAsGitHubError(errorMsg);

	Deno.exit(1);
}

/**
 * Checks if a variable value is null or undefined.
 * @param value The value to check.
 * @param funcName The name of the function that is calling this function.
 * @param paramName The name of the parameter that is being checked.
 */
export function isLessThanOne(value: undefined | null | number, funcName = "", paramName = ""): void {
	const isNullOrUndefined = value === undefined || value === null;
	if (isNullOrUndefined || isNaN(value) || !isFinite(value)) {
		Utils.printAsGitHubError("The value is undefined, null, NaN, Infinite, -Infinity.");

		if (funcName != "") {
			console.log(`Function Name: ${funcName}`);
		}

		if (paramName != "") {
			console.log(`Param Name: ${paramName}`);
		}

		Deno.exit(1);
	}

	if (value < 0) {
		Utils.printAsGitHubError("The value is less than or equal to zero.");

		if (funcName != "") {
			console.log(`Function Name: ${funcName}`);
		}

		if (paramName != "") {
			console.log(`Param Name: ${paramName}`);
		}

		Deno.exit(1);
	}
}

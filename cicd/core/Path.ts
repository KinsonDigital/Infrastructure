import { basename, extname } from "https://deno.land/std@0.194.0/path/mod.ts";
import { Utils } from "./Utils.ts";

/**
 * Provides file and directory path utilities.
 */
export class Path {
	/**
	 * Gets the file name from the given {@link filePath}.
	 * @param filePath The file path.
	 * @returns The file name from the given {@link filePath}.
	 */
	public static getFileName(filePath: string): string {
		if (Utils.isNullOrEmptyOrUndefined(filePath)) {
			return "";
		}

		return basename(filePath);
	}

	/**
	 * Gets the file extension from the given {@link filePath}.
	 * @param filePath The file path.
	 * @returns The file extension from the given {@link filePath}.
	 */
	public static getFileExtension(filePath: string): string {
		if (Utils.isNullOrEmptyOrUndefined(filePath)) {
			return "";
		}

		return extname(filePath);
	}

	/**
	 * Returns a value indicating whether or not the given {@link filePath} has an extension.
	 * @param filePath The file path.
	 * @param expectedExtension The extension to check for.
	 * @returns True if the given {@link filePath} has an extension; otherwise, false.
	 * <remarks If the {@link expectedExtension} is null, undefined, or empty, the value returned will
	 * represent if the given {@link filePath} has any extension.
	 */
	public static hasExtension(filePath: string, expectedExtension?: string): boolean {
		if (Utils.isNullOrEmptyOrUndefined(filePath)) {
			return false;
		}

		const fileExtension = Path.getFileExtension(filePath);

		return Utils.isNullOrEmptyOrUndefined(expectedExtension)
			? fileExtension.length > 0 && fileExtension.startsWith(".")
			: fileExtension === expectedExtension;
	}
}

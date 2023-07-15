import { existsSync } from "https://deno.land/std@0.194.0/fs/exists.ts";

/**
 * Provides directory functionality.
 */
export class Directory {
	/**
	 * Checks if the given directory path exists.
	 * @param dirPath The path of the directory to check.
	 * @returns True if the directory exists, otherwise false.
	 */
	public static Exists(dirPath: string): boolean {
		return existsSync(dirPath, { isDirectory: true, isFile: false });
	}

	/**
	 * Checks if the given directory path does not exist.
	 * @param dirPath The path of the directory to check.
	 * @returns True if the directory does not exist, otherwise false.
	 */
	public static DoesNotExist(dirPath: string): boolean {
		return !this.Exists(dirPath);
	}
}

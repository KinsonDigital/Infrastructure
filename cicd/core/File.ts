import { existsSync } from "https://deno.land/std@0.191.0/fs/exists.ts";

/**
 * Provides file functionality.
 */
export class File {
	/**
	 * Checks if the given file path exists.
	 * @param filePath The path of the file to check.
	 * @returns True if the file exists, otherwise false.
	 */
	public static Exists(filePath: string): boolean {
		return existsSync(filePath, { isFile: true, isDirectory: false });
	}

	/**
	 * Checks if the given file path does not exist.
	 * @param filePath The path of the file to check.
	 * @returns True if the file does not exist, otherwise false.
	 */
	public static DoesNotExist(filePath: string): boolean {
		return !this.Exists(filePath);
	}

	/**
	 * Loads the contents of the file at the given file path.
	 * @param filePath The path to the file to load.
	 * @returns The contents of the file.
	 */
	public static LoadFile(filePath: string): string {
		const file = Deno.readTextFileSync(filePath);

		return file;
	}
}

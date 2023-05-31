import { existsSync } from "https://deno.land/std@0.190.0/fs/exists.ts";

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
}

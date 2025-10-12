/**
 * Prints a status message in the console.
 * @param msg The message to display.
 * @param newLineAfter Whether to add a new line after the message.
 */
export function printStatusUpdate(msg: string, newLineAfter?: boolean): void {
	msg = msg.replace(/\.+$/, "");

	const newLine = newLineAfter ? "\n" : "";
	console.log(`%c\t⏳${msg}...${newLine}`, "color:darkgray");
}

/**
 * Prints a step message in the console.
 * @param msg The message to display.
 */
export function printStep(msg: string): void {
	console.log(`%c${msg}`, "color:cyan");
}

/**
 * Prints an error message in the console.
 * @param msg The message to display.
 */
export function printError(msg: string): void {
	console.log(`%c${msg}`, "color:indianred");
}

/**
 * Prints an informational message in the console.
 * @param msg The message to display.
 */
export function printInfo(msg: string, totalTabs?: number): void {
	const tabs = "\t".repeat(totalTabs ?? 0);
	console.log(`%c${tabs}${msg}`, "color:lightblue");
}

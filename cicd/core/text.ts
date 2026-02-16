/**
 * Calculates the byte positions of a specified occurrence of a substring within a given text.
 * @param text The text that contains the substring for which to calculate byte positions.
 * @param substring The substring for which to calculate byte positions within the text.
 * @param occurrence The occurrence of the substring.
 * @returns An object containing the byteStart and byteEnd positions of the specified occurrence of the substring, or null if the substring occurrence is not found.
 */
export function getBytePosition(
	text: string,
	substring: string,
	occurrence = 1,
): { byteStart: number; byteEnd: number } | null {
	const encoder = new TextEncoder();

	let index = -1;

	for (let i = 0; i < occurrence; i++) {
		index = text.indexOf(substring, index + 1);

		if (index === -1) {
			return null;
		}
	}

	const byteStart = encoder.encode(text.slice(0, index)).length;
	const byteEnd = byteStart + encoder.encode(substring).length;

	return { byteStart, byteEnd };
}

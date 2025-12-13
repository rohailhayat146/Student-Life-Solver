
/**
 * Reads a file and returns its content as a Base64 Data URL.
 * @param file The file to read.
 * @returns A promise that resolves to the Base64 string.
 */
export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

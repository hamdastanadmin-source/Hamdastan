/**
 * Saves text the API already returned as a file on the admin's machine.
 * No request leaves the browser: the export is built by `apps/api` and only
 * handed to the browser's own download here.
 */
export function saveTextFile(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

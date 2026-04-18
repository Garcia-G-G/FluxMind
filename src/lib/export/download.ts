export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (
  content: string,
  filename: string,
  mimeType = "text/plain"
): void => {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
};

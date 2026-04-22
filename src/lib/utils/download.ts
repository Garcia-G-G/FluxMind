/**
 * Download a remote image as a local file.
 *
 * Fetches the image, converts it to a Blob, and triggers a download via a
 * temporary `<a download>` element. Used by the slide viewer and the
 * infographic viewer so both share the same "Save image as…" UX.
 */
export const downloadImage = async (
  url: string,
  filename: string,
): Promise<void> => {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

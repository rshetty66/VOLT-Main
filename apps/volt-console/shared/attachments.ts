/** Files a user attaches to a request. The server turns each into plain text; the text travels with the run. */
export interface Attachment {
  name: string;
  text: string;
  /** The source-register key (S02, S03, ...) the server gives it, so the answer can cite the file. */
  key?: string;
  /** The uploads-library id, so tools such as the VOLT Ledger ingest can read the original file. */
  uploadId?: string;
}

export const ATTACH_MAX_FILES = 5;
export const ATTACH_MAX_BYTES = 4 * 1024 * 1024;
/** Per file and in total, so a few large files cannot swamp the model's context. */
export const ATTACH_MAX_CHARS_FILE = 40_000;
export const ATTACH_MAX_CHARS_TOTAL = 100_000;

export const ATTACH_EXTENSIONS = ["txt", "md", "csv", "tsv", "json", "xlsx", "docx", "pptx", "pdf", "jpg", "jpeg", "png"] as const;

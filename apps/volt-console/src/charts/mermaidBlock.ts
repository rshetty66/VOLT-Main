/** react-markdown gives fenced code blocks a "language-<lang>" class. */
export const isMermaid = (className: string | undefined) => /(^|\s)language-mermaid(\s|$)/.test(className ?? "");

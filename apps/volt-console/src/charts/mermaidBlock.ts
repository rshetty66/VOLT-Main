/** react-markdown gives fenced code blocks a "language-<lang>" class. */
export const isMermaid = (className: string | undefined) => /(^|\s)language-mermaid(\s|$)/.test(className ?? "");
/** A ```chart block: a data chart written as JSON (see shared/viz.ts). */
export const isChart = (className: string | undefined) => /(^|\s)language-chart(\s|$)/.test(className ?? "");
/** An ```architecture block: an architecture option as JSON, drawn as a 3D layered stack (see shared/viz.ts). */
export const isArchitecture = (className: string | undefined) => /(^|\s)language-architecture(\s|$)/.test(className ?? "");

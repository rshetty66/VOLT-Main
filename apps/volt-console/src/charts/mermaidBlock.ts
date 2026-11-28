/** react-markdown gives fenced code blocks a "language-<lang>" class. */
export const isMermaid = (className: string | undefined) => /(^|\s)language-mermaid(\s|$)/.test(className ?? "");
/** A ```chart block: a data chart written as JSON (see shared/viz.ts). */
export const isChart = (className: string | undefined) => /(^|\s)language-chart(\s|$)/.test(className ?? "");
/** An ```architecture block: an architecture option as JSON, drawn as a 3D layered stack (see shared/viz.ts). */
/** A ```process block: a process flow as JSON, drawn as swimlanes (see shared/viz.ts). */
export const isProcess = (className: string | undefined) => /(^|\s)language-process(\s|$)/.test(className ?? "");
export const isArchitecture = (className: string | undefined) => /(^|\s)language-architecture(\s|$)/.test(className ?? "");
/** A ```taxonomy or ```lifecycle block: an executive view as JSON (see shared/views.ts). Returns the fence name. */
export const viewKind = (className: string | undefined) => /(^|\s)language-(taxonomy|lifecycle|fim)(\s|$)/.exec(className ?? "")?.[2];

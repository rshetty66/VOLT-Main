import type { ReactElement } from "react";

/** HTML/SVG markup for an element, for downloads. react-dom/server loads on first use only. */
export async function staticMarkup(el: ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(el);
}

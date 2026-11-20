import { useEffect } from "react";

interface DocumentMetaOptions {
  title: string;
  description?: string;
  robots?: string;
}

const DEFAULT_TITLE = "Akasha — Product Studio for Small Teams";
const DEFAULT_DESCRIPTION =
  "Turn small-team product ideas into vertical feature slices, clickable mock-API prototypes, shared data & REST contracts, and exportable full-stack apps.";

function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Updates document <title>, meta description, and Open Graph / Twitter tags dynamically
 * per workspace, active view, or shareable prototype.
 */
export function useDocumentMeta({ title, description, robots }: DocumentMetaOptions) {
  useEffect(() => {
    const finalTitle = title || DEFAULT_TITLE;
    const finalDesc = description || DEFAULT_DESCRIPTION;

    document.title = finalTitle;
    setMetaTag("name", "description", finalDesc);
    setMetaTag("property", "og:title", finalTitle);
    setMetaTag("property", "og:description", finalDesc);
    setMetaTag("name", "twitter:title", finalTitle);
    setMetaTag("name", "twitter:description", finalDesc);

    if (robots) {
      setMetaTag("name", "robots", robots);
    }
  }, [title, description, robots]);
}

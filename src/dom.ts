const XCHAT_HOSTS = '[data-testid="xchatEmbedRoute"], [data-testid="xchatEmbedOverlays"]';

export function pageRoots(doc: Document): Array<Document | ShadowRoot> {
  return [doc, ...[...doc.querySelectorAll(XCHAT_HOSTS)]
    .flatMap(host => host.shadowRoot ? [host.shadowRoot] : [])];
}

export function pageQuery<T extends Element>(doc: Document, selector: string): T[] {
  return pageRoots(doc).flatMap(root => [...root.querySelectorAll<T>(selector)]);
}

export function composedParent(node: HTMLElement): HTMLElement | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}

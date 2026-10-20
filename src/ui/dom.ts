type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & {
  class?: string;
  style?: string | Partial<CSSStyleDeclaration>;
};

/**
 * Tiny hyperscript helper: h('div.card#id', { onclick }, children...)
 * Keys starting with "on" become listeners, everything else becomes an attribute.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}.${string}` | `${K}#${string}`,
  attrs?: Attrs | Child,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [, name, rest] = /^([a-z0-9-]+)(.*)$/i.exec(tag)!;
  const el = document.createElement(name) as HTMLElementTagNameMap[K];
  for (const part of rest.match(/[.#][^.#]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs as Child);
  } else if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        on(el, k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.className = `${el.className} ${v}`.trim();
      } else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v as Record<string, string>)) {
          // custom properties must go through setProperty; plain assignment silently drops them
          if (prop.startsWith('--')) el.style.setProperty(prop, String(val));
          else (el.style as unknown as Record<string, string>)[prop] = val;
        }
      } else if (k === 'value' && 'value' in el) {
        (el as HTMLInputElement).value = String(v);
      } else if (k === 'checked' && 'checked' in el) {
        (el as HTMLInputElement).checked = Boolean(v);
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ── Event handlers ──────────────────────────────────────────────────────────
// Handlers live in a per-element table and are invoked through one shared
// listener. When morph() patches an existing element it simply swaps in the
// new table, so the element always runs the latest closure (never stale data).

type Handlers = Record<string, EventListener>;
const HANDLERS = Symbol('handlers');
type WithHandlers = Element & { [HANDLERS]?: Handlers };

function dispatch(this: WithHandlers, e: Event): void {
  this[HANDLERS]?.[e.type]?.call(this, e);
}

function on(el: Element, type: string, fn: EventListener): void {
  const w = el as WithHandlers;
  (w[HANDLERS] ??= {})[type] = fn;
  el.addEventListener(type, dispatch as EventListener); // same function reference, so never added twice
}

// ── In-place DOM patching ───────────────────────────────────────────────────

/**
 * Patch `from` (live, on screen) so it matches `to` (freshly rendered), reusing
 * existing nodes wherever the structure lines up. Because the live elements
 * stay in the document, hover states, scroll positions and focus survive a
 * redraw instead of flickering.
 */
export function morph(from: Node, to: Node): Node {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName || from.nodeName === 'CANVAS') {
    // canvases are drawn when built, so take the new one wholesale
    (from as ChildNode).replaceWith(to);
    return to;
  }
  if (from.nodeType === Node.TEXT_NODE || from.nodeType === Node.COMMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return from;
  }
  const a = from as WithHandlers;
  const b = to as WithHandlers;

  // attributes (style and class included)
  for (const attr of [...a.attributes]) if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
  for (const attr of [...b.attributes]) if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);

  // event handlers
  const nextHandlers = b[HANDLERS];
  if (nextHandlers) for (const type of Object.keys(nextHandlers)) a.addEventListener(type, dispatch as EventListener);
  a[HANDLERS] = nextHandlers;

  // children, matched by position
  const oldKids = [...a.childNodes];
  const newKids = [...b.childNodes];
  newKids.forEach((child, i) => {
    if (i < oldKids.length) morph(oldKids[i], child);
    else a.appendChild(child);
  });
  for (let i = newKids.length; i < oldKids.length; i++) oldKids[i].remove();

  // live form state lives in properties, not attributes; leave the field being edited alone
  if (a !== document.activeElement) {
    if (a instanceof HTMLInputElement && b instanceof HTMLInputElement) {
      if (a.value !== b.value) a.value = b.value;
      if (a.checked !== b.checked) a.checked = b.checked;
    } else if (a instanceof HTMLSelectElement && b instanceof HTMLSelectElement) {
      if (a.value !== b.value) a.value = b.value;
    } else if (a instanceof HTMLTextAreaElement && b instanceof HTMLTextAreaElement) {
      if (a.value !== b.value) a.value = b.value;
    }
  }
  return a;
}

/** Make `container`'s single child match `next`, patching in place when possible. */
export function patchInto(container: Element, next: Node): void {
  const current = container.firstChild;
  if (!current || container.childNodes.length !== 1) {
    container.replaceChildren(next);
    return;
  }
  morph(current, next);
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** A meter bar, colour shifts from red to green as value rises. */
export function meter(value: number, max = 100, opts: { invert?: boolean; label?: string } = {}): HTMLElement {
  const ratio = Math.max(0, Math.min(1, value / max));
  const good = opts.invert ? 1 - ratio : ratio;
  const hue = Math.round(good * 120);
  return h('div.meter', { title: opts.label ?? '' },
    h('div.meter-fill', { style: { width: `${ratio * 100}%`, background: `hsl(${hue} 80% 50%)` } }),
  );
}

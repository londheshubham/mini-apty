import { CapturedStep, ElementPointer } from "../shared/messages";

const STABLE_ATTRIBUTES = [
  "data-testid",
  "data-test",
  "data-cy",
  "aria-label",
  "name",
  "id",
  "type",
  "href",
  "placeholder",
];

const trimText = (value: string | null | undefined, maxLength = 120) => {
  return value?.replace(/\s+/g, " ").trim().slice(0, maxLength);
};

const escapeSelectorValue = (value: string) => {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

export const getElementText = (element: HTMLElement) => {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return trimText(
      element.getAttribute("aria-label") ??
        element.placeholder ??
        element.value ??
        element.name,
    );
  }

  return trimText(
    element.getAttribute("aria-label") ?? element.innerText ?? element.textContent,
  );
};

export const getRole = (element: HTMLElement) => {
  const explicitRole = element.getAttribute("role");

  if (explicitRole) {
    return explicitRole;
  }

  const tagName = element.tagName.toLowerCase();

  if (tagName === "button") {
    return "button";
  }

  if (tagName === "a") {
    return "link";
  }

  if (tagName === "select") {
    return "combobox";
  }

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return element.type;
    }

    return "textbox";
  }

  if (tagName === "textarea") {
    return "textbox";
  }

  return undefined;
};

const getStableAttributes = (element: HTMLElement) => {
  return STABLE_ATTRIBUTES.reduce<Record<string, string>>((attributes, name) => {
    const value = element.getAttribute(name);

    if (value) {
      attributes[name] = value;
    }

    return attributes;
  }, {});
};

const getNthOfType = (element: HTMLElement) => {
  let index = 1;
  let sibling = element.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }

    sibling = sibling.previousElementSibling;
  }

  return index;
};

const buildDomPath = (element: HTMLElement) => {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.documentElement) {
    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}:nth-of-type(${getNthOfType(current)})`);
    current = current.parentElement;
  }

  return `html > ${parts.join(" > ")}`;
};

const getCandidateSelectors = (element: HTMLElement) => {
  const tagName = element.tagName.toLowerCase();
  const selectors: string[] = [];

  for (const attribute of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);

    if (!value) {
      continue;
    }

    if (attribute === "id") {
      selectors.push(`#${CSS.escape(value)}`);
      continue;
    }

    selectors.push(
      `${tagName}[${attribute}="${escapeSelectorValue(value)}"]`,
      `[${attribute}="${escapeSelectorValue(value)}"]`,
    );
  }

  const role = getRole(element);
  const text = getElementText(element);

  if (role) {
    selectors.push(`${tagName}[role="${escapeSelectorValue(role)}"]`);
  }

  if (text && text.length <= 60) {
    selectors.push(tagName);
  }

  selectors.push(buildDomPath(element));

  return [...new Set(selectors)];
};

const getPreferredSelector = (candidateSelectors: string[]) => {
  const usableSelector = candidateSelectors.find((selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  });

  return usableSelector ?? candidateSelectors[0] ?? "body";
};

const getStrategy = (
  selector: string,
  element: HTMLElement,
): ElementPointer["strategy"] => {
  if (selector.startsWith("#")) {
    return "id-selector";
  }

  if (selector === buildDomPath(element)) {
    return "dom-path";
  }

  if (selector.includes("[")) {
    return "attribute-selector";
  }

  return "css-selector";
};

export const buildElementPointer = (element: HTMLElement): ElementPointer => {
  const candidateSelectors = getCandidateSelectors(element);
  const selector = getPreferredSelector(candidateSelectors);
  const text = getElementText(element);

  return {
    strategy: getStrategy(selector, element),
    selector,
    candidateSelectors,
    fallbackPath: buildDomPath(element),
    ...(text ? { text, textFingerprint: text.toLowerCase() } : {}),
    ...(getRole(element) ? { role: getRole(element) } : {}),
    tagName: element.tagName.toLowerCase(),
    attributes: getStableAttributes(element),
  };
};

export const createCapturedStep = (element: HTMLElement): CapturedStep => {
  const text = getElementText(element);

  return {
    id: crypto.randomUUID(),
    title: text ? `Step for ${text}` : "New step",
    description: "Describe what the user should do here.",
    element: buildElementPointer(element),
    advanceTrigger: element.matches("input, textarea, select")
      ? "input-change"
      : "next-button",
  };
};

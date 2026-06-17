import { CapturedStep } from "../shared/messages";
import { getRole } from "./element-pointer";
import { isElementVisible, isOverlayElement } from "./overlay";

const FORM_CONTROL_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='textbox']",
  "[role='combobox']",
].join(",");

const getVisibleElementsForSelector = (selector: string) => {
  try {
    return [...document.querySelectorAll(selector)].filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !isOverlayElement(element) &&
        isElementVisible(element),
    );
  } catch {
    return [];
  }
};

const normalizeSearchText = (value: string | null | undefined) => {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
};

const isInputChangeTarget = (element: HTMLElement) => {
  return element.matches(FORM_CONTROL_SELECTOR);
};

const getCompactElementText = (element: HTMLElement) => {
  const text = normalizeSearchText(element.innerText ?? element.textContent);

  if (!text || text.length > 80) {
    return "";
  }

  return text;
};

const getReferencedText = (ids: string | null) => {
  if (!ids) {
    return "";
  }

  return ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
};

const getAssociatedLabelText = (element: HTMLElement) => {
  const labelledByText = getReferencedText(element.getAttribute("aria-labelledby"));

  if (labelledByText) {
    return labelledByText;
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return [...(element.labels ?? [])]
      .map((label) => label.textContent ?? "")
      .join(" ");
  }

  const id = element.id;

  if (!id) {
    return "";
  }

  try {
    return document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent ?? "";
  } catch {
    return "";
  }
};

const getNearbyLabelText = (element: HTMLElement) => {
  let current: HTMLElement | null = element;

  for (let depth = 0; depth < 5 && current?.parentElement; depth += 1) {
    let sibling = current.previousElementSibling;
    let checkedSiblings = 0;

    while (sibling && checkedSiblings < 3) {
      if (sibling instanceof HTMLElement && !sibling.matches(FORM_CONTROL_SELECTOR)) {
        const siblingText = getCompactElementText(sibling);

        if (siblingText) {
          return siblingText;
        }
      }

      sibling = sibling.previousElementSibling;
      checkedSiblings += 1;
    }

    const label = [...current.parentElement.children].find((child) => {
      return (
        child instanceof HTMLLabelElement &&
        child !== current &&
        !child.contains(current)
      );
    });

    if (label instanceof HTMLElement) {
      const labelText = getCompactElementText(label);

      if (labelText) {
        return labelText;
      }
    }

    current = current.parentElement;
  }

  return "";
};

const getSearchableElementText = (element: HTMLElement) => {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const placeholder =
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element.placeholder
        : "";

    return normalizeSearchText(
      [
        element.getAttribute("aria-label"),
        getAssociatedLabelText(element),
        getNearbyLabelText(element),
        placeholder,
        element.id,
        element.value,
        element.name,
        element.getAttribute("data-testid"),
        element.getAttribute("data-test"),
        element.getAttribute("data-cy"),
      ].join(" "),
    );
  }

  return normalizeSearchText(
    [
      element.getAttribute("aria-label"),
      getReferencedText(element.getAttribute("aria-labelledby")),
      isInputChangeTarget(element) ? getNearbyLabelText(element) : "",
      element.id,
      element.getAttribute("data-testid"),
      element.getAttribute("data-test"),
      element.getAttribute("data-cy"),
      element.innerText,
      element.textContent,
    ].join(" "),
  );
};

const getExpectedTargetText = (step: CapturedStep) => {
  return normalizeSearchText(step.element.textFingerprint ?? step.element.text);
};

const getTextMatchScore = (expectedText: string, actualText: string) => {
  if (!expectedText || !actualText) {
    return 0;
  }

  if (actualText === expectedText) {
    return 8;
  }

  if (actualText.includes(expectedText)) {
    return 6;
  }

  return 0;
};

const getPlaybackTargetScore = (step: CapturedStep, element: HTMLElement) => {
  let score = 0;
  const tagName = element.tagName.toLowerCase();
  const role = getRole(element);
  const text = getSearchableElementText(element);
  const expectedText = getExpectedTargetText(step);

  if (step.element.tagName && step.element.tagName === tagName) {
    score += 2;
  }

  if (step.element.role && step.element.role === role) {
    score += 3;
  }

  if (step.element.attributes) {
    for (const [name, value] of Object.entries(step.element.attributes)) {
      if (element.getAttribute(name) === value) {
        score += 2;
      }
    }
  }

  score += getTextMatchScore(expectedText, text);

  return score;
};

const isCompatiblePlaybackTarget = (step: CapturedStep, element: HTMLElement) => {
  if (step.advanceTrigger !== "input-change") {
    return true;
  }

  return isInputChangeTarget(element);
};

const hasStrongPlaybackHints = (step: CapturedStep) => {
  return Boolean(
    step.element.textFingerprint ||
      step.element.text ||
      step.element.role ||
      Object.keys(step.element.attributes ?? {}).length > 0,
  );
};

const isBroadPlaybackSelector = (selector: string, matchCount: number) => {
  return /^[a-z][a-z0-9-]*$/i.test(selector.trim()) || matchCount > 5;
};

export const resolvePlaybackTarget = (step: CapturedStep) => {
  const selectors = [
    step.element.selector,
    ...step.element.candidateSelectors,
    step.element.fallbackPath,
  ].filter((selector, index, allSelectors) => {
    return Boolean(selector) && allSelectors.indexOf(selector) === index;
  });
  const requiresHints = hasStrongPlaybackHints(step);

  for (const selector of selectors) {
    const elements = getVisibleElementsForSelector(selector);

    if (elements.length === 0) {
      continue;
    }

    const scoredElements = elements
      .filter((element) => isCompatiblePlaybackTarget(step, element))
      .map((element) => ({
        element,
        score: getPlaybackTargetScore(step, element),
        textScore: getTextMatchScore(
          getExpectedTargetText(step),
          getSearchableElementText(element),
        ),
      }))
      .sort((first, second) => second.score - first.score);
    const bestMatch = scoredElements[0];
    const selectorIsBroad = isBroadPlaybackSelector(selector, elements.length);
    const expectedText = getExpectedTargetText(step);

    if (!bestMatch) {
      continue;
    }

    if (expectedText && bestMatch.textScore === 0) {
      continue;
    }

    if (bestMatch.score >= 4) {
      return bestMatch.element;
    }

    if (!requiresHints && !selectorIsBroad) {
      return bestMatch.element;
    }
  }

  return null;
};

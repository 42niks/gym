function getFieldLabel(form: HTMLFormElement, field: HTMLElement): string {
  if (field instanceof HTMLInputElement && field.labels && field.labels.length > 0) {
    const labelText = field.labels[0]?.textContent?.trim();
    if (labelText) return labelText;
  }

  const id = field.getAttribute('id');
  if (id) {
    const label = form.querySelector(`label[for="${id}"]`);
    const labelText = label?.textContent?.trim();
    if (labelText) return labelText;
  }

  return 'This field';
}

function getValidationMessage(form: HTMLFormElement, field: HTMLElement): string {
  const label = getFieldLabel(form, field);

  if (
    field instanceof HTMLInputElement
    || field instanceof HTMLSelectElement
    || field instanceof HTMLTextAreaElement
  ) {
    if (field.validity.valueMissing) return `${label} is required.`;
    if (field.validity.typeMismatch) return `${label} is not valid.`;
    if (field.validity.patternMismatch) return `${label} is not valid.`;
    if (field.validity.rangeUnderflow || field.validity.rangeOverflow) return `${label} is out of range.`;
  }

  return `${label} is not valid.`;
}

export function getFirstFormErrorMessage(form: HTMLFormElement): string | null {
  const controls = Array.from(form.elements);
  for (const control of controls) {
    if (
      control instanceof HTMLInputElement
      || control instanceof HTMLSelectElement
      || control instanceof HTMLTextAreaElement
    ) {
      if (control.willValidate && !control.checkValidity()) {
        return getValidationMessage(form, control);
      }
    }
  }
  return null;
}

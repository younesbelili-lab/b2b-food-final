export function nextAllowedDeliveryDate(now = new Date()): Date {
  const local = new Date(now);
  const cutoff = new Date(now);
  cutoff.setHours(19, 0, 0, 0);

  const daysToAdd = local <= cutoff ? 1 : 2;
  const result = new Date(local);
  result.setDate(local.getDate() + daysToAdd);
  result.setHours(9, 0, 0, 0);
  return result;
}

export function isDeliveryDateAllowed(
  selectedDateIso: string,
  now = new Date(),
): boolean {
  const selected = new Date(selectedDateIso);
  if (Number.isNaN(selected.getTime())) {
    return false;
  }

  const minDate = nextAllowedDeliveryDate(now);
  selected.setHours(0, 0, 0, 0);
  minDate.setHours(0, 0, 0, 0);
  return selected >= minDate;
}

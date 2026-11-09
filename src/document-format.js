export function formatProviderDocument(value) {
  if (value === null || value === undefined) return value;
  const text = String(value);
  const digits = text.replace(/[.\/\s-]/g, '');
  if (/^\d{11}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (/^\d{14}$/.test(digits)) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return text;
}

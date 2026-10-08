// The shop's contact address. While it is a placeholder (*.example) the site
// never pretends to send anything: it offers to copy the proposal instead.
export const CONTACT_EMAIL = 'hola@aerflora.example';

export const hasRealContact = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(CONTACT_EMAIL) && !/\.example$/i.test(CONTACT_EMAIL);

export const mailto = (subject, body = '') =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

// Client-side checks mirror the server's Zod rules so users get instant feedback.
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

export function passwordIssues(v = '') {
  const issues = [];
  if (v.length < 8) issues.push('at least 8 characters');
  if (!/[a-z]/.test(v)) issues.push('a lowercase letter');
  if (!/[A-Z]/.test(v)) issues.push('an uppercase letter');
  if (!/\d/.test(v)) issues.push('a number');
  return issues;
}

export const EMPTY_ADDRESS = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '' };

export function validateAddress(a) {
  const e = {};
  if (!a.fullName || a.fullName.trim().length < 2) e.fullName = 'Full name is required';
  if (!/^[6-9]\d{9}$/.test(a.phone || '')) e.phone = 'Enter a valid 10-digit mobile number';
  if (!a.line1 || a.line1.trim().length < 3) e.line1 = 'Address is required';
  if (!a.city || a.city.trim().length < 2) e.city = 'City is required';
  if (!a.state || a.state.trim().length < 2) e.state = 'State is required';
  if (!/^\d{6}$/.test(a.postalCode || '')) e.postalCode = 'Enter a valid 6-digit PIN code';
  return e;
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

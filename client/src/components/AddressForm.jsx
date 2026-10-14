import { Field } from './ui.jsx';
import { INDIAN_STATES } from '../utils/validation.js';

export function AddressForm({ value, onChange, errors = {}, idPrefix = 'addr' }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const id = (k) => `${idPrefix}-${k}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" id={id('fullName')} error={errors.fullName}>
        <input id={id('fullName')} className="input" autoComplete="name" value={value.fullName} onChange={set('fullName')} />
      </Field>
      <Field label="Mobile number" id={id('phone')} error={errors.phone}>
        <input id={id('phone')} className="input" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address (house no., building, street)" id={id('line1')} error={errors.line1}>
          <input id={id('line1')} className="input" autoComplete="address-line1" value={value.line1} onChange={set('line1')} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Locality / landmark (optional)" id={id('line2')}>
          <input id={id('line2')} className="input" autoComplete="address-line2" value={value.line2} onChange={set('line2')} />
        </Field>
      </div>
      <Field label="City" id={id('city')} error={errors.city}>
        <input id={id('city')} className="input" autoComplete="address-level2" value={value.city} onChange={set('city')} />
      </Field>
      <Field label="State" id={id('state')} error={errors.state}>
        <select id={id('state')} className="input" value={value.state} onChange={set('state')}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="PIN code" id={id('postalCode')} error={errors.postalCode}>
        <input id={id('postalCode')} className="input" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={value.postalCode} onChange={(e) => onChange({ ...value, postalCode: e.target.value.replace(/\D/g, '') })} />
      </Field>
    </div>
  );
}

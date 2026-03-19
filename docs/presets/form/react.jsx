// snippet: form-signup
// category: forms
// rationale: components/forms.md
// requires: tailwindcss

import { useState } from 'react';

export function SignupForm({ onSubmit }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirm: '', company: '', address: '',
    city: '', zip: '', country: '', state: '', terms: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const passwordStrength = (pw) => {
    if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
    let score = 0;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', width: 'w-1/2' };
    if (score <= 2) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  };

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (!form.city.trim()) errs.city = 'City is required';
    if (!form.zip.trim()) errs.zip = 'ZIP is required';
    if (!form.country) errs.country = 'Country is required';
    if (!form.state) errs.state = 'State is required';
    if (!form.terms) errs.terms = 'You must accept the terms';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await onSubmit?.(form);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full bg-transparent border-0 border-b outline-none pb-2 text-base text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 transition-colors min-h-11 ${
      errors[field]
        ? 'border-b-red-500 dark:border-b-red-400'
        : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-400'
    }`;

  const selectClass = (field) =>
    `w-full bg-transparent border-0 border-b outline-none pb-2 text-base text-slate-900 dark:text-white transition-colors min-h-11 ${
      errors[field]
        ? 'border-b-red-500 dark:border-b-red-400'
        : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-400'
    }`;

  const labelClass = 'block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2';

  const strength = form.password ? passwordStrength(form.password) : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
      {/* First name */}
      <div>
        <label htmlFor="signup-first-name" className={labelClass}>First name</label>
        <input id="signup-first-name" type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Jane" className={inputClass('firstName')} autoComplete="given-name" />
        {errors.firstName && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.firstName}</p>}
      </div>

      {/* Last name */}
      <div>
        <label htmlFor="signup-last-name" className={labelClass}>Last name</label>
        <input id="signup-last-name" type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Smith" className={inputClass('lastName')} autoComplete="family-name" />
        {errors.lastName && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.lastName}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="signup-email" className={labelClass}>Email address</label>
        <input id="signup-email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="jane@example.com" className={inputClass('email')} autoComplete="email" />
        {errors.email && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="signup-phone" className={labelClass}>Phone</label>
        <input id="signup-phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+1 (555) 000-0000" className={inputClass('phone')} autoComplete="tel" />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="signup-password" className={labelClass}>Password</label>
        <input id="signup-password" type="password" value={form.password} onChange={e => update('password', e.target.value)} className={inputClass('password')} autoComplete="new-password" />
        {strength && (
          <div className="mt-2">
            <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{strength.label}</p>
          </div>
        )}
        {errors.password && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
      </div>

      {/* Confirm password */}
      <div>
        <label htmlFor="signup-confirm" className={labelClass}>Confirm password</label>
        <input id="signup-confirm" type="password" value={form.confirm} onChange={e => update('confirm', e.target.value)} className={inputClass('confirm')} autoComplete="new-password" />
        {errors.confirm && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.confirm}</p>}
      </div>

      {/* Company */}
      <div>
        <label htmlFor="signup-company" className={labelClass}>Company <span className="normal-case tracking-normal">(optional)</span></label>
        <input id="signup-company" type="text" value={form.company} onChange={e => update('company', e.target.value)} placeholder="Acme Inc." className={inputClass('company')} autoComplete="organization" />
      </div>

      {/* Address */}
      <div>
        <label htmlFor="signup-address" className={labelClass}>Address</label>
        <input id="signup-address" type="text" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St" className={inputClass('address')} autoComplete="street-address" />
        {errors.address && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.address}</p>}
      </div>

      {/* City & ZIP */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="signup-city" className={labelClass}>City</label>
          <input id="signup-city" type="text" value={form.city} onChange={e => update('city', e.target.value)} placeholder="San Francisco" className={inputClass('city')} autoComplete="address-level2" />
          {errors.city && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.city}</p>}
        </div>
        <div>
          <label htmlFor="signup-zip" className={labelClass}>ZIP</label>
          <input id="signup-zip" type="text" value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="94102" className={inputClass('zip')} autoComplete="postal-code" />
          {errors.zip && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.zip}</p>}
        </div>
      </div>

      {/* Country & State */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label htmlFor="signup-country" className={labelClass}>Country</label>
          <select id="signup-country" value={form.country} onChange={e => update('country', e.target.value)} className={selectClass('country')} autoComplete="country">
            <option value="">Select</option>
            <option>United States</option>
            <option>Canada</option>
            <option>United Kingdom</option>
          </select>
          {errors.country && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.country}</p>}
        </div>
        <div>
          <label htmlFor="signup-state" className={labelClass}>State</label>
          <select id="signup-state" value={form.state} onChange={e => update('state', e.target.value)} className={selectClass('state')} autoComplete="address-level1">
            <option value="">Select</option>
            <option>California</option>
            <option>New York</option>
            <option>Texas</option>
          </select>
          {errors.state && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.state}</p>}
        </div>
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer min-h-11">
        <input type="checkbox" checked={form.terms} onChange={e => update('terms', e.target.checked)} className="mt-1 w-4 h-4 accent-blue-600" />
        <span className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          I agree to the <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded">terms and conditions</a>
        </span>
      </label>
      {errors.terms && <p className="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>}

      {/* Submit */}
      <button type="submit" disabled={loading} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4 min-h-11 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      {/* Helper links */}
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account? <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Sign in</a>
      </p>
    </form>
  );
}

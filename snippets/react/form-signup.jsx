// snippet: form-signup
// category: forms
// rationale: components/forms.md
// requires: tailwindcss

import { useState } from 'react';

export function SignupForm({ onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', terms: false });
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
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match';
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
      await onSubmit?.({ name: form.name, email: form.email, password: form.password });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2.5 text-base bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11 ${
      errors[field] ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
    }`;

  const strength = form.password ? passwordStrength(form.password) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="signup-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full name</label>
        <input id="signup-name" type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Jane Doe" className={inputClass('name')} autoComplete="name" />
        {errors.name && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
        <input id="signup-email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" className={inputClass('email')} autoComplete="email" />
        {errors.email && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
        <input id="signup-password" type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 8 characters" className={inputClass('password')} autoComplete="new-password" />
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

      <div>
        <label htmlFor="signup-confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm password</label>
        <input id="signup-confirm" type="password" value={form.confirm} onChange={e => update('confirm', e.target.value)} placeholder="Re-enter your password" className={inputClass('confirm')} autoComplete="new-password" />
        {errors.confirm && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.confirm}</p>}
      </div>

      <div className="flex items-start gap-2">
        <input id="signup-terms" type="checkbox" checked={form.terms} onChange={e => update('terms', e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500" />
        <label htmlFor="signup-terms" className="text-sm text-slate-600 dark:text-slate-400">
          I agree to the <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>
        </label>
      </div>
      {errors.terms && <p className="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>}

      <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2">
        {loading && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
        {loading ? 'Creating account...' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account? <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign in</a>
      </p>
    </form>
  );
}

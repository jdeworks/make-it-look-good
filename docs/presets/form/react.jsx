// snippet: form-signup
// category: forms
// rationale: components/forms.md
// requires: tailwindcss

import { useState, useCallback, memo } from 'react';

const labelClass = 'block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2';

// Stable node for the company label — defined at module level so React.memo's
// shallow comparison sees the same reference every render.
const companyLabelNode = <>Company <span className="font-normal text-slate-600 dark:text-slate-300">(optional)</span></>;

// Memoized field — renders label, input, and inline error as a single memo boundary.
// Each instance receives a stable onChange (useCallback) plus primitive value/error props,
// so it skips re-rendering unless its own slice of state changes.
const Field = memo(function Field({ id, name, label, type, value, error, onChange, placeholder, autoComplete, required }) {
  const inputCls = `w-full min-h-11 rounded-lg border bg-white dark:bg-slate-950 px-4 py-3 text-base text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-300 outline-none transition-colors focus:ring-2 focus:ring-blue-600/25 dark:focus:ring-blue-400/30 ${
    error
      ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400'
      : 'border-slate-300 dark:border-slate-600 focus:border-slate-950 dark:focus:border-white'
  }`;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} name={name} type={type} value={value} onChange={onChange} autoComplete={autoComplete} required={required} placeholder={placeholder} className={inputCls} />
      {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export function SignupForm({ onSubmit }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', company: '', terms: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Stable updater — setForm is guaranteed stable by React, so dep array is empty.
  const update = useCallback((field, value) => setForm(prev => ({ ...prev, [field]: value })), []);

  // Per-field onChange handlers — justified by being passed to memo'd Field instances.
  // update is stable (never changes), so each handler is also permanently stable.
  const onFirstNameChange = useCallback(e => update('firstName', e.target.value), [update]);
  const onLastNameChange  = useCallback(e => update('lastName',  e.target.value), [update]);
  const onEmailChange     = useCallback(e => update('email',     e.target.value), [update]);
  const onPhoneChange     = useCallback(e => update('phone',     e.target.value), [update]);
  const onPasswordChange  = useCallback(e => update('password',  e.target.value), [update]);
  const onCompanyChange   = useCallback(e => update('company',   e.target.value), [update]);

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-5 py-10 sm:px-6 sm:py-14">
      <main className="w-full max-w-md" aria-labelledby="form-title">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm px-6 py-8 sm:px-8 sm:py-10">
          <header className="text-center mb-8 sm:mb-10">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200 mb-3">Acme Access</p>
            <h1 id="form-title" className="text-3xl font-semibold text-slate-950 dark:text-white tracking-tight mb-3">Create account</h1>
            <p id="form-description" className="text-sm leading-6 text-slate-700 dark:text-slate-300">Set up your workspace profile.</p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-labelledby="form-title" aria-describedby="form-description" noValidate>
            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field id="form-first-name" name="first-name" label="First name" type="text" value={form.firstName} error={errors.firstName} onChange={onFirstNameChange} autoComplete="given-name" required placeholder="Jane" />
              <Field id="form-last-name" name="last-name" label="Last name" type="text" value={form.lastName} error={errors.lastName} onChange={onLastNameChange} autoComplete="family-name" required placeholder="Smith" />
            </div>

            {/* Email */}
            <Field id="form-email" name="email" label="Email address" type="email" value={form.email} error={errors.email} onChange={onEmailChange} autoComplete="email" required placeholder="jane@example.com" />

            {/* Phone */}
            <Field id="form-phone" name="phone" label="Phone" type="tel" value={form.phone} error={errors.phone} onChange={onPhoneChange} autoComplete="tel" placeholder="+1 (555) 000-0000" />

            {/* Password */}
            <Field id="form-password" name="password" label="Password" type="password" value={form.password} error={errors.password} onChange={onPasswordChange} autoComplete="new-password" required placeholder="••••••••" />

            {/* Company */}
            <Field
              id="form-company"
              name="company"
              label={companyLabelNode}
              type="text"
              value={form.company}
              error={errors.company}
              onChange={onCompanyChange}
              autoComplete="organization"
              placeholder="Acme Inc."
            />

            {/* Terms — checkbox structure differs from text Field; handled inline */}
            <label className="flex items-start gap-3 cursor-pointer min-h-11">
              <input id="form-terms" name="terms" type="checkbox" checked={form.terms} onChange={e => update('terms', e.target.checked)} required className="mt-1 h-4 w-4 accent-slate-950 dark:accent-white" />
              <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">I agree to the <a href="#" className="font-medium text-slate-950 dark:text-white underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 rounded">terms and conditions</a></span>
            </label>
            {errors.terms && <p className="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>}

            {/* Submit */}
            <button type="submit" disabled={loading} className="w-full h-14 min-h-11 rounded-lg bg-slate-950 dark:bg-white text-base font-medium text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </section>

        {/* Helper link */}
        <p className="text-center mt-7 text-sm text-slate-700 dark:text-slate-300">
          Already have an account?{' '}
          <a href="#" className="font-medium text-slate-950 dark:text-white underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 rounded">Sign in</a>
        </p>
      </main>
    </div>
  );
}

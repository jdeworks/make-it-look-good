// snippet: form-login
// category: forms
// rationale: components/forms.md
// requires: tailwindcss

import { useState, useCallback, memo } from 'react';

// Memoized field — renders label, input, and inline error as a single memo boundary.
// Each instance receives a stable onChange (useCallback) plus primitive value/error props,
// so it skips re-rendering unless its own slice of state changes.
const Field = memo(function Field({ id, label, type, value, error, onChange, placeholder, autoComplete }) {
  const inputCls = `w-full border rounded-lg px-3 py-2.5 text-base bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11 ${
    error ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
  }`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} className={inputCls} autoComplete={autoComplete} />
      {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export function LoginShell({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Per-field onChange handlers — justified by being passed to memo'd Field instances.
  // setEmail/setPassword are guaranteed stable by React, so dep arrays are empty.
  const onEmailChange    = useCallback((e) => setEmail(e.target.value), []);
  const onPasswordChange = useCallback((e) => setPassword(e.target.value), []);

  const validate = () => {
    const errs = {};
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await onSubmit?.({ email, password });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Minimal header */}
      <header className="py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <a href="#" className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none text-lg font-bold text-slate-900 dark:text-white">BrandName</a>
        </div>
      </header>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            {/* Form header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Field
                id="login-email"
                label="Email"
                type="email"
                value={email}
                error={errors.email}
                onChange={onEmailChange}
                placeholder="you@example.com"
                autoComplete="email"
              />

              <Field
                id="login-password"
                label="Password"
                type="password"
                value={password}
                error={errors.password}
                onChange={onPasswordChange}
                placeholder="Enter your password"
                autoComplete="current-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2"
              >
                {loading && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Footer link */}
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              Don't have an account?{' '}
              <a href="#" className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none text-blue-700 dark:text-blue-400 hover:underline font-semibold">Sign up</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

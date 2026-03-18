<!-- snippet: form-login
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->

<script>
  let { onSubmit } = $props();

  let email = $state('');
  let password = $state('');
  let remember = $state(false);
  let errors = $state({});
  let loading = $state(false);

  function validate() {
    const errs = {};
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    errors = errs;
    if (Object.keys(errs).length > 0) return;

    loading = true;
    try {
      await onSubmit?.({ email, password, remember });
    } finally {
      loading = false;
    }
  }

  function inputClass(field) {
    return `w-full border rounded-lg px-3 py-2.5 text-base bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11 ${
      errors[field] ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
    }`;
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4" novalidate>
  <div>
    <label for="login-email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
      Email
    </label>
    <input
      id="login-email"
      type="email"
      bind:value={email}
      placeholder="you@example.com"
      class={inputClass('email')}
      autocomplete="email"
    />
    {#if errors.email}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
    {/if}
  </div>

  <div>
    <div class="flex items-center justify-between mb-1.5">
      <label for="login-password" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Password
      </label>
      <a href="#" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">Forgot password?</a>
    </div>
    <input
      id="login-password"
      type="password"
      bind:value={password}
      placeholder="Enter your password"
      class={inputClass('password')}
      autocomplete="current-password"
    />
    {#if errors.password}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
    {/if}
  </div>

  <div class="flex items-center gap-2">
    <input
      id="login-remember"
      type="checkbox"
      bind:checked={remember}
      class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
    />
    <label for="login-remember" class="text-sm text-slate-600 dark:text-slate-400">
      Remember me
    </label>
  </div>

  <button
    type="submit"
    disabled={loading}
    class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2"
  >
    {#if loading}
      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    {/if}
    {loading ? 'Signing in...' : 'Sign In'}
  </button>

  <p class="text-center text-sm text-slate-600 dark:text-slate-400">
    Don't have an account?
    <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign up</a>
  </p>
</form>

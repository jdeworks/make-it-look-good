<!-- snippet: form-signup
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->

<script>
  let { onSubmit } = $props();

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let confirm = $state('');
  let terms = $state(false);
  let errors = $state({});
  let loading = $state(false);

  function passwordStrength(pw) {
    if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
    let score = 0;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', width: 'w-1/2' };
    if (score <= 2) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  }

  let strength = $derived(password ? passwordStrength(password) : null);

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (password !== confirm) errs.confirm = 'Passwords do not match';
    if (!terms) errs.terms = 'You must accept the terms';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    errors = errs;
    if (Object.keys(errs).length > 0) return;
    loading = true;
    try {
      await onSubmit?.({ name, email, password });
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
    <label for="signup-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full name</label>
    <input id="signup-name" type="text" bind:value={name} placeholder="Jane Doe" class={inputClass('name')} autocomplete="name" />
    {#if errors.name}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
    {/if}
  </div>

  <div>
    <label for="signup-email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
    <input id="signup-email" type="email" bind:value={email} placeholder="you@example.com" class={inputClass('email')} autocomplete="email" />
    {#if errors.email}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
    {/if}
  </div>

  <div>
    <label for="signup-password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
    <input id="signup-password" type="password" bind:value={password} placeholder="At least 8 characters" class={inputClass('password')} autocomplete="new-password" />
    {#if strength}
      <div class="mt-2">
        <div class="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div class={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{strength.label}</p>
      </div>
    {/if}
    {#if errors.password}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
    {/if}
  </div>

  <div>
    <label for="signup-confirm" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm password</label>
    <input id="signup-confirm" type="password" bind:value={confirm} placeholder="Re-enter your password" class={inputClass('confirm')} autocomplete="new-password" />
    {#if errors.confirm}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.confirm}</p>
    {/if}
  </div>

  <div class="flex items-start gap-2">
    <input id="signup-terms" type="checkbox" bind:checked={terms} class="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500" />
    <label for="signup-terms" class="text-sm text-slate-600 dark:text-slate-400">
      I agree to the <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a> and <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>
    </label>
  </div>
  {#if errors.terms}
    <p class="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>
  {/if}

  <button type="submit" disabled={loading} class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2">
    {#if loading}
      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
    {/if}
    {loading ? 'Creating account...' : 'Create Account'}
  </button>

  <p class="text-center text-sm text-slate-600 dark:text-slate-400">
    Already have an account? <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign in</a>
  </p>
</form>

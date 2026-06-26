<!-- snippet: form-signup
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->

<script>
  let { onSubmit } = $props();

  let firstName = $state('');
  let lastName = $state('');
  let email = $state('');
  let phone = $state('');
  let password = $state('');
  let company = $state('');
  let terms = $state(false);
  let errors = $state({});
  let loading = $state(false);

  function validate() {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
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
      await onSubmit?.({ firstName, lastName, email, phone, password, company });
    } finally {
      loading = false;
    }
  }

  function inputClass(field) {
    return `w-full min-h-11 rounded-lg border bg-white dark:bg-slate-950 px-4 py-3 text-base text-slate-950 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-300 outline-none transition-colors focus:ring-2 focus:ring-blue-600/25 dark:focus:ring-blue-400/30 ${
      errors[field]
        ? 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400'
        : 'border-slate-300 dark:border-slate-600 focus:border-slate-950 dark:focus:border-white'
    }`;
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-5 py-10 sm:px-6 sm:py-14">
  <main class="w-full max-w-md" aria-labelledby="form-title">
    <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm px-6 py-8 sm:px-8 sm:py-10">
      <header class="text-center mb-8 sm:mb-10">
        <p class="text-xs font-semibold tracking-[0.18em] uppercase text-slate-700 dark:text-slate-200 mb-3">Acme Access</p>
        <h1 id="form-title" class="text-3xl font-semibold text-slate-950 dark:text-white tracking-tight mb-3">Create account</h1>
        <p id="form-description" class="text-sm leading-6 text-slate-700 dark:text-slate-300">Set up your workspace profile.</p>
      </header>

      <form onsubmit={handleSubmit} class="flex flex-col gap-6" aria-labelledby="form-title" aria-describedby="form-description" novalidate>
        <!-- Name -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label for="form-first-name" class="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">First name</label>
            <input id="form-first-name" name="first-name" type="text" bind:value={firstName} autocomplete="given-name" required placeholder="Jane" class={inputClass('firstName')} />
            {#if errors.firstName}
              <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.firstName}</p>
            {/if}
          </div>
          <div>
            <label for="form-last-name" class="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Last name</label>
            <input id="form-last-name" name="last-name" type="text" bind:value={lastName} autocomplete="family-name" required placeholder="Smith" class={inputClass('lastName')} />
            {#if errors.lastName}
              <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.lastName}</p>
            {/if}
          </div>
        </div>

        <!-- Email -->
        <div>
          <label for="form-email" class="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Email address</label>
          <input id="form-email" name="email" type="email" bind:value={email} autocomplete="email" required placeholder="jane@example.com" class={inputClass('email')} />
          {#if errors.email}
            <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
          {/if}
        </div>

        <!-- Phone -->
        <div>
          <label for="form-phone" class="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Phone</label>
          <input id="form-phone" name="phone" type="tel" bind:value={phone} autocomplete="tel" placeholder="+1 (555) 000-0000" class={inputClass('phone')} />
        </div>

        <!-- Password -->
        <div>
          <label for="form-password" class="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Password</label>
          <input id="form-password" name="password" type="password" bind:value={password} autocomplete="new-password" required placeholder="••••••••" class={inputClass('password')} />
          {#if errors.password}
            <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
          {/if}
        </div>

        <!-- Company -->
        <div>
          <label for="form-company" class="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">Company <span class="font-normal text-slate-600 dark:text-slate-300">(optional)</span></label>
          <input id="form-company" name="company" type="text" bind:value={company} autocomplete="organization" placeholder="Acme Inc." class={inputClass('company')} />
        </div>

        <!-- Terms -->
        <label class="flex items-start gap-3 cursor-pointer min-h-11">
          <input id="form-terms" name="terms" type="checkbox" bind:checked={terms} required class="mt-1 h-4 w-4 accent-slate-950 dark:accent-white" />
          <span class="text-sm leading-6 text-slate-700 dark:text-slate-300">I agree to the <a href="#" class="font-medium text-slate-950 dark:text-white underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 rounded">terms and conditions</a></span>
        </label>
        {#if errors.terms}
          <p class="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>
        {/if}

        <!-- Submit -->
        <button type="submit" disabled={loading} class="w-full h-14 min-h-11 rounded-lg bg-slate-950 dark:bg-white text-base font-medium text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </section>

    <!-- Helper link -->
    <p class="text-center mt-7 text-sm text-slate-700 dark:text-slate-300">
      Already have an account?
      <a href="#" class="font-medium text-slate-950 dark:text-white underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 rounded">Sign in</a>
    </p>
  </main>
</div>

<!-- snippet: form-login
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->
<script setup>
import { ref, reactive } from 'vue'

const emit = defineEmits(['submit'])

const email = ref('')
const password = ref('')
const remember = ref(false)
const errors = reactive({})
const loading = ref(false)

function validate() {
  const errs = {}
  if (!email.value) errs.email = 'Email is required'
  else if (!/\S+@\S+\.\S+/.test(email.value)) errs.email = 'Enter a valid email'
  if (!password.value) errs.password = 'Password is required'
  else if (password.value.length < 8) errs.password = 'Password must be at least 8 characters'
  return errs
}

async function handleSubmit() {
  Object.keys(errors).forEach(k => delete errors[k])
  const errs = validate()
  Object.assign(errors, errs)
  if (Object.keys(errs).length > 0) return

  loading.value = true
  try {
    emit('submit', { email: email.value, password: password.value, remember: remember.value })
  } finally {
    loading.value = false
  }
}

function inputClass(field) {
  return [
    'w-full border rounded-lg px-3 py-2.5 text-base bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11',
    errors[field] ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
  ].join(' ')
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4" novalidate>
    <div>
      <label for="login-email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
      <input
        id="login-email"
        v-model="email"
        type="email"
        placeholder="you@example.com"
        :class="inputClass('email')"
        autocomplete="email"
      >
      <p v-if="errors.email" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.email }}</p>
    </div>

    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label for="login-password" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
        <a href="#" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">Forgot password?</a>
      </div>
      <input
        id="login-password"
        v-model="password"
        type="password"
        placeholder="Enter your password"
        :class="inputClass('password')"
        autocomplete="current-password"
      >
      <p v-if="errors.password" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.password }}</p>
    </div>

    <div class="flex items-center gap-2">
      <input
        id="login-remember"
        v-model="remember"
        type="checkbox"
        class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
      >
      <label for="login-remember" class="text-sm text-slate-600 dark:text-slate-400">Remember me</label>
    </div>

    <button
      type="submit"
      :disabled="loading"
      class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2"
    >
      <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {{ loading ? 'Signing in...' : 'Sign In' }}
    </button>

    <p class="text-center text-sm text-slate-600 dark:text-slate-400">
      Don't have an account? <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign up</a>
    </p>
  </form>
</template>

<!-- snippet: form-signup
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->
<script setup>
import { ref, reactive, computed } from 'vue'

const emit = defineEmits(['submit'])

const form = reactive({ name: '', email: '', password: '', confirm: '', terms: false })
const errors = reactive({})
const loading = ref(false)

function passwordStrength(pw) {
  if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' }
  let score = 0
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (pw.length >= 12) score++
  if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', width: 'w-1/2' }
  if (score <= 2) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' }
  return { label: 'Strong', color: 'bg-green-500', width: 'w-full' }
}

const strength = computed(() => form.password ? passwordStrength(form.password) : null)

function validate() {
  const errs = {}
  if (!form.name.trim()) errs.name = 'Name is required'
  if (!form.email) errs.email = 'Email is required'
  else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
  if (!form.password) errs.password = 'Password is required'
  else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
  if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
  if (!form.terms) errs.terms = 'You must accept the terms'
  return errs
}

async function handleSubmit() {
  Object.keys(errors).forEach(k => delete errors[k])
  const errs = validate()
  Object.assign(errors, errs)
  if (Object.keys(errs).length > 0) return
  loading.value = true
  try {
    emit('submit', { name: form.name, email: form.email, password: form.password })
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
      <label for="signup-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full name</label>
      <input id="signup-name" v-model="form.name" type="text" placeholder="Jane Doe" :class="inputClass('name')" autocomplete="name">
      <p v-if="errors.name" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.name }}</p>
    </div>

    <div>
      <label for="signup-email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
      <input id="signup-email" v-model="form.email" type="email" placeholder="you@example.com" :class="inputClass('email')" autocomplete="email">
      <p v-if="errors.email" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.email }}</p>
    </div>

    <div>
      <label for="signup-password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
      <input id="signup-password" v-model="form.password" type="password" placeholder="At least 8 characters" :class="inputClass('password')" autocomplete="new-password">
      <div v-if="strength" class="mt-2">
        <div class="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div :class="['h-full rounded-full transition-all duration-300', strength.color, strength.width]" />
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ strength.label }}</p>
      </div>
      <p v-if="errors.password" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.password }}</p>
    </div>

    <div>
      <label for="signup-confirm" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm password</label>
      <input id="signup-confirm" v-model="form.confirm" type="password" placeholder="Re-enter your password" :class="inputClass('confirm')" autocomplete="new-password">
      <p v-if="errors.confirm" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.confirm }}</p>
    </div>

    <div class="flex items-start gap-2">
      <input id="signup-terms" v-model="form.terms" type="checkbox" class="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500">
      <label for="signup-terms" class="text-sm text-slate-600 dark:text-slate-400">
        I agree to the <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a> and <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>
      </label>
    </div>
    <p v-if="errors.terms" class="text-sm text-red-600 dark:text-red-400">{{ errors.terms }}</p>

    <button type="submit" :disabled="loading" class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2">
      <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      {{ loading ? 'Creating account...' : 'Create Account' }}
    </button>

    <p class="text-center text-sm text-slate-600 dark:text-slate-400">
      Already have an account? <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign in</a>
    </p>
  </form>
</template>

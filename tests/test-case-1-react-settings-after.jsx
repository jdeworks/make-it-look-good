// Test Case 1: React Settings Page — Improved
// Fixes all Critical and Important issues from design review.
// Drop-in replacement: same state variables, same handleSave pattern.

import { useState } from 'react';

// Design tokens from review
const tokens = {
  color: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    text: '#0f172a',
    textSecondary: '#475569',
    label: '#334155',
    border: '#e2e8f0',
    surface: '#f8fafc',
    success: '#16a34a',
    successBg: '#f0fdf4',
    error: '#dc2626',
    cancelHover: '#e2e8f0',
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
  radius: { sm: 4, md: 8, lg: 12 },
  fontSize: { sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24 },
  minTarget: 44,
};

const focusRing = {
  outline: `2px solid ${tokens.color.primary}`,
  outlineOffset: '2px',
};

export default function Settings() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState('light');
  const [saved, setSaved] = useState(false);

  // Track focus for inline focus-visible styles
  const [focused, setFocused] = useState(null);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFocus = (field) => () => setFocused(field);
  const handleBlur = () => setFocused(null);

  const inputStyle = (field) => ({
    width: '100%',
    padding: `${tokens.space.3}px ${tokens.space.4}px`,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    fontSize: tokens.fontSize.base,
    lineHeight: 1.5,
    color: tokens.color.text,
    backgroundColor: '#fff',
    minHeight: tokens.minTarget,
    boxSizing: 'border-box',
    ...(focused === field ? focusRing : { outline: 'none' }),
  });

  const labelStyle = {
    display: 'block',
    fontSize: tokens.fontSize.sm,
    fontWeight: 600,
    color: tokens.color.label,
    marginBottom: tokens.space.2,
  };

  const fieldGroup = {
    marginBottom: tokens.space.5,
  };

  const sectionHeading = {
    fontSize: tokens.fontSize.lg,
    fontWeight: 600,
    color: tokens.color.text,
    marginTop: 0,
    marginBottom: tokens.space.5,
  };

  return (
    <div
      style={{
        maxWidth: 672,
        margin: '0 auto',
        padding: tokens.space.6,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: tokens.color.text,
        fontSize: tokens.fontSize.base,
        lineHeight: 1.5,
      }}
    >
      <h1
        style={{
          fontSize: tokens.fontSize['2xl'],
          fontWeight: 700,
          marginTop: 0,
          marginBottom: tokens.space.2,
        }}
      >
        Settings
      </h1>
      <p
        style={{
          color: tokens.color.textSecondary,
          fontSize: tokens.fontSize.base,
          marginTop: 0,
          marginBottom: tokens.space.8,
        }}
      >
        Manage your account settings and preferences
      </p>

      {/* Profile Section */}
      <fieldset
        style={{
          border: 'none',
          margin: 0,
          padding: 0,
          marginBottom: tokens.space.8,
        }}
      >
        <legend style={sectionHeading}>Profile</legend>

        <div style={fieldGroup}>
          <label htmlFor="name" style={labelStyle}>
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={handleFocus('name')}
            onBlur={handleBlur}
            style={inputStyle('name')}
          />
        </div>

        <div style={fieldGroup}>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={handleFocus('email')}
            onBlur={handleBlur}
            style={inputStyle('email')}
          />
        </div>

        <div style={fieldGroup}>
          <label htmlFor="bio" style={labelStyle}>
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onFocus={handleFocus('bio')}
            onBlur={handleBlur}
            style={{
              ...inputStyle('bio'),
              minHeight: 96,
              resize: 'vertical',
            }}
          />
        </div>
      </fieldset>

      {/* Preferences Section */}
      <fieldset
        style={{
          border: 'none',
          margin: 0,
          padding: 0,
          marginBottom: tokens.space.8,
        }}
      >
        <legend style={sectionHeading}>Preferences</legend>

        <div style={fieldGroup}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space.3,
              minHeight: tokens.minTarget,
            }}
          >
            <input
              type="checkbox"
              id="notifications"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
              onFocus={handleFocus('notifications')}
              onBlur={handleBlur}
              style={{
                width: 20,
                height: 20,
                accentColor: tokens.color.primary,
                cursor: 'pointer',
                ...(focused === 'notifications' ? focusRing : {}),
              }}
            />
            <label
              htmlFor="notifications"
              style={{
                fontSize: tokens.fontSize.base,
                color: tokens.color.text,
                cursor: 'pointer',
              }}
            >
              Email notifications
            </label>
          </div>
        </div>

        <div style={fieldGroup}>
          <label htmlFor="theme" style={labelStyle}>
            Theme
          </label>
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onFocus={handleFocus('theme')}
            onBlur={handleBlur}
            style={{
              ...inputStyle('theme'),
              cursor: 'pointer',
              appearance: 'auto',
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </fieldset>

      {/* Actions */}
      <div style={{ display: 'flex', gap: tokens.space.3 }}>
        <button
          onClick={handleSave}
          onFocus={handleFocus('save')}
          onBlur={handleBlur}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              tokens.color.primaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tokens.color.primary;
          }}
          style={{
            padding: `${tokens.space.2}px ${tokens.space.4}px`,
            minHeight: tokens.minTarget,
            backgroundColor: tokens.color.primary,
            color: '#fff',
            border: 'none',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.base,
            fontWeight: 600,
            cursor: 'pointer',
            ...(focused === 'save' ? focusRing : { outline: 'none' }),
          }}
        >
          Save
        </button>
        <button
          onFocus={handleFocus('cancel')}
          onBlur={handleBlur}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              tokens.color.cancelHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tokens.color.surface;
          }}
          style={{
            padding: `${tokens.space.2}px ${tokens.space.4}px`,
            minHeight: tokens.minTarget,
            backgroundColor: tokens.color.surface,
            color: tokens.color.text,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.base,
            fontWeight: 600,
            cursor: 'pointer',
            ...(focused === 'cancel' ? focusRing : { outline: 'none' }),
          }}
        >
          Cancel
        </button>
      </div>

      {/* Success feedback */}
      {saved && (
        <div
          role="status"
          style={{
            marginTop: tokens.space.4,
            padding: `${tokens.space.3}px ${tokens.space.4}px`,
            backgroundColor: tokens.color.successBg,
            border: `1px solid ${tokens.color.success}`,
            borderRadius: tokens.radius.md,
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space.2,
          }}
        >
          <span style={{ fontSize: tokens.fontSize.base }}>&#10003;</span>
          <span
            style={{
              fontSize: tokens.fontSize.sm,
              color: tokens.color.success,
              fontWeight: 500,
            }}
          >
            Settings saved!
          </span>
        </div>
      )}
    </div>
  );
}

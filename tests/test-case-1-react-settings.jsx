// Test Case 1: React Settings Page
// A developer built this quickly. It "works" but looks bad.
// They'd say: "Can you make this look good?"

import { useState } from 'react';

export default function Settings() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState('light');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: '10px' }}>
      <h1 style={{ marginBottom: '5px' }}>Settings</h1>
      <p style={{ color: 'gray', fontSize: '12px' }}>Manage your account settings and preferences</p>

      <div style={{ marginTop: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: '#666' }}>Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: '#666' }}>Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#666' }}>Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px', height: '60px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
          <input type="checkbox" checked={notifications} onChange={e => setNotifications(e.target.checked)} />
          <span style={{ fontSize: '12px' }}>Email notifications</span>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#666' }}>Theme</label>
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px' }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
          <button
            onClick={handleSave}
            style={{ padding: '5px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}
          >
            Save
          </button>
          <button
            style={{ padding: '5px 12px', background: '#eee', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>

        {saved && <p style={{ color: 'green', fontSize: '11px', marginTop: '5px' }}>Settings saved!</p>}
      </div>
    </div>
  );
}

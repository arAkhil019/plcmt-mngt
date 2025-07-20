// lib/adminApi.js
// Utility to call the secure admin creation API from the frontend

export async function createAdminUser({ email, password, name }) {
  const res = await fetch('/api/createAdmin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create admin user');
  return data;
}

export async function createRegularUser({ email, password, userData }) {
  const res = await fetch('/api/createUser', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, userData }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data;
}

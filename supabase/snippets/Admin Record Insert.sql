INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  password_hash,
  is_active,
  created_at,
  updated_at
) VALUES (
  'usr-admin-001',
  'admin@smartpenacademy.com',
  'Admin',
  'Coach',
  '8861751000',
  'admin',
  -- Precomputed bcrypt hash for password: Admin@SmartPen2026
  '$2b$10$zkgI8pF3UaNpN7Og0Ddit..LiDy99fywIN54BYdvkOGYZY3uuzHqm',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  role = 'admin',
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE,
  updated_at = NOW();

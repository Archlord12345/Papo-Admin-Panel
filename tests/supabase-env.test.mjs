import { describe, expect, it } from 'vitest';

describe('configuration Supabase publique', () => {
  it('contient une URL et une clé publique acceptée par Auth', async () => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(url).toMatch(/^https?:\/\//);
    expect(key).toBeTruthy();

    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
    });

    expect(response.status).toBeLessThan(400);
  });
});

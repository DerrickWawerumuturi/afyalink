const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:5000/api');
export async function getHealth() { const response = await fetch(`${baseUrl}/health`); if (!response.ok) throw new Error('API unavailable'); return response.json(); }

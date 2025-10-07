import { useMemo } from 'react';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

export function useApi(adminPin?: string) {
  return useMemo(() => {
    const baseHeaders: Record<string, string> = {};
    if (adminPin) {
      baseHeaders['x-admin-pin'] = adminPin;
    }
    return async function apiFetch<T>(url: string, options: RequestOptions = {}) {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...baseHeaders,
          ...options.headers,
        },
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Network error');
      }
      if (response.status === 204) {
        return null as T;
      }
      return (await response.json()) as T;
    };
  }, [adminPin]);
}

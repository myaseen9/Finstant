/**
 * Backend origin for new code.
 *
 * Most existing call sites hardcode http://127.0.0.1:8000, which breaks the
 * moment the app is deployed anywhere. Migrating all of them is out of scope
 * for the frontend pass, but nothing written from here on should add to the
 * pile — import API_BASE instead.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined ? process.env.NEXT_PUBLIC_API_URL : '';

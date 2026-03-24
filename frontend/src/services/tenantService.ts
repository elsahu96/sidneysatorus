export function getTenantId(email: string) {
  if (email.endsWith("@satorusgroup.com"))
    return import.meta.env.VITE_SATORUS_TENANT_ID;

  return null; // default tenant
}

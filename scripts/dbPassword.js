/**
 * Reads the Supabase database password from the environment so it never
 * lives in the repo. Run scripts as:
 *   SUPABASE_DB_PASSWORD='...' node scripts/<name>.js
 */
export function requireDbPassword() {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    console.error(
      "SUPABASE_DB_PASSWORD is not set. Run: SUPABASE_DB_PASSWORD='your-password' node " +
        (process.argv[1] || 'scripts/<name>.js')
    );
    process.exit(1);
  }
  return password;
}

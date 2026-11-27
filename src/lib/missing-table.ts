// A table that a pending migration creates (e.g. product_options before
// 20261126000000 is applied). Only "the table does not exist" counts: any
// other database error must still fail the request.
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  // PGRST205 = PostgREST "Could not find the table … in the schema cache";
  // 42P01 = Postgres undefined_table.
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** Postgres `raise exception 'code[:detail]'` -> { code, detail } */
export function parseRpcError(message: string | undefined): { code: string; detail?: string } {
  if (!message) return { code: "generic" };
  const [code, detail] = message.split(":");
  return { code: code.trim(), detail: detail?.trim() };
}

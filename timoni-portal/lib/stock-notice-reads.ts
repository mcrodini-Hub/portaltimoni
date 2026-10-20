type Need = { id: string; unidade: string; status: string; respondidoEm?: string; observacao?: string };
export function canReceiveStockNotice(email: string) {
  return ["mcrodini@gmail.com", "estoquetimoni@gmail.com"].includes(email.trim().toLowerCase());
}
export function pendingStockIds(email: string, needs: Need[]) {
  email = email.trim().toLowerCase();
  if (!canReceiveStockNotice(email)) return [];
  return needs.filter(n => n.status === "pendente" && !n.respondidoEm && !n.observacao && (email === "mcrodini@gmail.com" || n.unidade === "rio_claro")).map(n => n.id);
}

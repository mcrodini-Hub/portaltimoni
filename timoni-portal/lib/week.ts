// O portal sempre trabalha no fuso America/Sao_Paulo. O Brasil aboliu o
// horário de verão em 2019, então esse offset fixo de -3h nunca muda ao
// longo do ano — o que evita depender do fuso do ambiente onde o código
// roda (servidor na Vercel vs. navegador do usuário), que poderia divergir.
const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000;

export interface WeekDay {
  date: Date; // meia-noite (America/Sao_Paulo) daquele dia, como instante real
  dayIndex: number; // 0 = domingo .. 6 = sábado
}

export function getWeekRange(referenceDate: Date = new Date()): {
  start: Date;
  end: Date;
  days: WeekDay[];
} {
  const shiftedNow = new Date(referenceDate.getTime() + SAO_PAULO_OFFSET_MS);
  const dayOfWeek = shiftedNow.getUTCDay();

  const startShiftedMs = Date.UTC(
    shiftedNow.getUTCFullYear(),
    shiftedNow.getUTCMonth(),
    shiftedNow.getUTCDate() - dayOfWeek
  );

  const start = new Date(startShiftedMs - SAO_PAULO_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(start.getTime() + i * 24 * 60 * 60 * 1000),
    dayIndex: i,
  }));

  return { start, end, days };
}

// A qual dia da semana (0=domingo..6=sábado) um horário de evento pertence,
// no fuso America/Sao_Paulo. Só é usado para agrupar eventos que já vieram
// filtrados dentro de uma semana específica (ver getWeekRange).
export function saoPauloDayIndex(iso: string): number {
  if (!iso.includes("T")) {
    // Evento de dia inteiro: a data já vem "pura" (sem horário/fuso).
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }
  const shifted = new Date(new Date(iso).getTime() + SAO_PAULO_OFFSET_MS);
  return shifted.getUTCDay();
}

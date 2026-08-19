import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Motorista",
};

export default function MotoristaLeituraPage() {
  return (
    <div className="w-full">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Casa Timoni</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Motorista</h1>
        <p className="mt-1 text-sm text-slate-600">Visualização somente para leitura.</p>
      </header>
      <iframe
        src="/motorista"
        title="Visualização do motorista"
        className="min-h-[calc(100vh-13rem)] w-full rounded-2xl border border-slate-200 bg-white"
      />
    </div>
  );
}

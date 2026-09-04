"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firmarSolicitud } from "@/app/cliente/actions";

const ANCHO_CANVAS = 600;
const ALTO_CANVAS = 220;

function coordenadasDelEvento(
  canvas: HTMLCanvasElement,
  evento: React.PointerEvent<HTMLCanvasElement>
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const escalaX = canvas.width / rect.width;
  const escalaY = canvas.height / rect.height;
  return {
    x: (evento.clientX - rect.left) * escalaX,
    y: (evento.clientY - rect.top) * escalaY,
  };
}

/** Cuadro para dibujar la firma a mano (mouse o dedo) y enviarla como imagen junto con el pagaré. */
export function FirmaCanvas({ solicitudId }: { solicitudId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujandoRef = useRef(false);
  const [tieneFirma, setTieneFirma] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function contextoConEstilo(): CanvasRenderingContext2D | null {
    const ctx = canvasRef.current?.getContext("2d") ?? null;
    if (ctx) {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
    return ctx;
  }

  function iniciarTrazo(evento: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = contextoConEstilo();
    if (!canvas || !ctx) return;
    dibujandoRef.current = true;
    const { x, y } = coordenadasDelEvento(canvas, evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function continuarTrazo(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = contextoConEstilo();
    if (!canvas || !ctx) return;
    const { x, y } = coordenadasDelEvento(canvas, evento);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!tieneFirma) setTieneFirma(true);
  }

  function terminarTrazo() {
    dibujandoRef.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setTieneFirma(false);
    setError(null);
  }

  async function enviarFirma() {
    const canvas = canvasRef.current;
    if (!canvas || !tieneFirma) return;
    setEnviando(true);
    setError(null);

    const dataUrl = canvas.toDataURL("image/png");
    const resultado = await firmarSolicitud(solicitudId, dataUrl);

    if (!resultado.ok) {
      setError(resultado.error);
      setEnviando(false);
      return;
    }

    router.push("/cliente?exito=" + encodeURIComponent("Firmaste tu pagaré. Un administrador dará la aprobación final."));
    router.refresh();
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <p className="text-sm text-slate-300 font-medium">Dibuja tu firma aquí abajo</p>
      <canvas
        ref={canvasRef}
        width={ANCHO_CANVAS}
        height={ALTO_CANVAS}
        onPointerDown={iniciarTrazo}
        onPointerMove={continuarTrazo}
        onPointerUp={terminarTrazo}
        onPointerLeave={terminarTrazo}
        className="w-full h-auto bg-white rounded-lg border border-slate-700 touch-none cursor-crosshair"
      />
      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={limpiar}
          disabled={enviando}
          className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-md px-4 py-2 disabled:opacity-50"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={enviarFirma}
          disabled={!tieneFirma || enviando}
          className="text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-md px-4 py-2"
        >
          {enviando ? "Enviando..." : "Firmar y enviar"}
        </button>
      </div>
    </div>
  );
}

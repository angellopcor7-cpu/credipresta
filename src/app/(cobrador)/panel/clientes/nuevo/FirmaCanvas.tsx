"use client";

import { useRef, useState } from "react";

/**
 * Cuadrícula para firmar con el dedo o el mouse. No usa ninguna librería —
 * es un <canvas> con eventos de puntero. Cuando hay trazo, avisa al padre
 * con el PNG (data URL) del dibujo; al borrar, avisa con null.
 */
export function FirmaCanvas({
  etiqueta,
  onChange,
}: {
  etiqueta: string;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const tieneTrazo = useRef(false);
  const [vacio, setVacio] = useState(true);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    tieneTrazo.current = true;
    setVacio(false);
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (tieneTrazo.current) {
      onChange(canvasRef.current!.toDataURL("image/png"));
    }
  }

  function limpiar() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    tieneTrazo.current = false;
    setVacio(true);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-slate-300">{etiqueta}</p>
      <canvas
        ref={canvasRef}
        width={500}
        height={150}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        className="w-full touch-none rounded-md bg-white border border-slate-700 cursor-crosshair"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${vacio ? "text-slate-500" : "text-amber-400"}`}>
          {vacio ? "Sin firmar" : "Firmado"}
        </span>
        <button type="button" onClick={limpiar} className="text-xs text-slate-400 hover:text-white underline">
          Borrar y firmar de nuevo
        </button>
      </div>
    </div>
  );
}

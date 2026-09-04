import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exigirAdministrador } from "@/lib/auth/roles";
import { generarPagarePDF } from "@/lib/pdf/pagare";

type PrestamoParaPagare = {
  id: string;
  monto_prestado: number;
  porcentaje_interes: number;
  monto_total: number;
  monto_cuota_sugerida: number;
  plazo_dias: number;
  fecha_inicio: string;
  clientes: { nombre_completo: string } | null;
  cobradores: { usuarios: { nombre_completo: string } | null } | null;
};

/** Genera (al vuelo, sin guardar nada) el PDF del pagaré de un préstamo con sus datos ya llenados. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigirAdministrador();
  const { id } = await params;
  const supabase = await createClient();

  const { data: prestamo } = await supabase
    .from("prestamos")
    .select(
      "id, monto_prestado, porcentaje_interes, monto_total, monto_cuota_sugerida, plazo_dias, fecha_inicio, clientes(nombre_completo), cobradores(usuarios(nombre_completo))"
    )
    .eq("id", id)
    .single();

  if (!prestamo) {
    return NextResponse.json({ error: "Préstamo no encontrado" }, { status: 404 });
  }

  const p = prestamo as unknown as PrestamoParaPagare;

  const fechaInicio = new Date(`${p.fecha_inicio}T00:00:00Z`);
  const fechaFin = new Date(fechaInicio);
  fechaFin.setUTCDate(fechaFin.getUTCDate() + p.plazo_dias);

  const bytes = await generarPagarePDF({
    folio: p.id.slice(0, 8).toUpperCase(),
    nombreCliente: p.clientes?.nombre_completo ?? "Cliente",
    montoPrestado: Number(p.monto_prestado),
    porcentajeInteres: Number(p.porcentaje_interes),
    montoTotal: Number(p.monto_total),
    montoCuotaDiaria: Number(p.monto_cuota_sugerida),
    plazoDias: p.plazo_dias,
    fechaInicio,
    fechaFin,
    fechaFirma: fechaInicio,
    nombreCobrador: p.cobradores?.usuarios?.nombre_completo ?? "Administración de CrediPresta",
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pagare-${p.id.slice(0, 8)}.pdf"`,
    },
  });
}

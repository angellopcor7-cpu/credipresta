import Link from "next/link";
import { NuevoClienteForm } from "./NuevoClienteForm";

/** "Crear nuevo cliente" — solo lo usa el cobrador (QUE SOLO LA USE EL COBRADOR). */
export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/panel" className="text-sm text-slate-400 hover:text-white">
          ← Mis clientes
        </Link>
        <h1 className="text-2xl font-bold mt-1">Nuevo cliente</h1>
        <p className="text-slate-400 text-sm">
          Sube la foto del pagaré ya firmado a mano y del INE, elige el plan y esta solicitud queda pendiente hasta
          que Empresa la apruebe.
        </p>
      </div>

      <NuevoClienteForm error={error} />
    </div>
  );
}

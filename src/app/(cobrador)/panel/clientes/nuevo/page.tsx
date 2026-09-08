import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
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
        <Link href="/panel" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Mis clientes
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <div className="rounded-lg bg-amber-500/10 p-1.5">
            <UserPlus className="h-5 w-5 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold">Nuevo cliente</h1>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Sube la foto del pagaré ya firmado a mano y del INE, elige el plan y esta solicitud queda pendiente hasta
          que Empresa la apruebe.
        </p>
      </div>

      <NuevoClienteForm error={error} />
    </div>
  );
}

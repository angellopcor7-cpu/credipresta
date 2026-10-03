"use client";

import { useMemo, useState } from "react";
import { UserRound, Landmark, CalendarClock, FileImage, CircleCheck, FileText, PenLine } from "lucide-react";
import { crearClienteYSolicitud } from "../../../actions";
import { FirmaCanvas } from "./FirmaCanvas";
import {
  calcularPorcentajeInteresPorPlan,
  calcularInteres,
  calcularMontoTotal,
  calcularCuotaSugerida,
  type PlanPrestamo,
} from "@/lib/finance/calculos";

const DIAS_SEMANA = [
  { valor: 0, label: "Domingo" },
  { valor: 1, label: "Lunes" },
  { valor: 2, label: "Martes" },
  { valor: 3, label: "Miércoles" },
  { valor: 4, label: "Jueves" },
  { valor: 5, label: "Viernes" },
  { valor: 6, label: "Sábado" },
];
const DIAS_ENTRE_SEMANA = [1, 2, 3, 4, 5];

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fechaCorta(d: Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function NuevoClienteForm({
  error,
  nombreCobrador,
  lugarPagare,
  interesMoratorioDiarioPagare,
}: {
  error?: string;
  nombreCobrador: string;
  lugarPagare: string;
  interesMoratorioDiarioPagare: number;
}) {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [monto, setMonto] = useState("");
  const [tipoPlan, setTipoPlan] = useState<PlanPrestamo | "personalizado">(20);
  const [diasPersonalizado, setDiasPersonalizado] = useState("");
  const [porcentajePersonalizado, setPorcentajePersonalizado] = useState("");
  const [personalizarDias, setPersonalizarDias] = useState(false);
  const [diasElegidos, setDiasElegidos] = useState<number[]>(DIAS_ENTRE_SEMANA);

  const [pagareGenerado, setPagareGenerado] = useState(false);
  const [folio, setFolio] = useState("");
  const [lugar, setLugar] = useState(lugarPagare || "");
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);
  const [firmaCobrador, setFirmaCobrador] = useState<string | null>(null);

  const preview = useMemo(() => {
    const montoNum = Number(monto);
    const dias = tipoPlan === "personalizado" ? Number(diasPersonalizado) : tipoPlan;
    if (!montoNum || montoNum <= 0 || !dias || dias <= 0) return null;

    let porcentaje: number;
    if (tipoPlan === "personalizado") {
      const pct = Number(porcentajePersonalizado);
      if (!pct || pct <= 0) return null;
      porcentaje = pct;
    } else {
      porcentaje = calcularPorcentajeInteresPorPlan(tipoPlan);
    }

    const interes = calcularInteres(montoNum, porcentaje);
    const total = calcularMontoTotal(montoNum, porcentaje);
    const pagoDiario = calcularCuotaSugerida(total, dias);

    return { porcentaje, interes, total, pagoDiario, dias };
  }, [monto, tipoPlan, diasPersonalizado, porcentajePersonalizado]);

  function alternarDia(dia: number) {
    setDiasElegidos((actual) => (actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia].sort()));
    invalidarPagareSiHacia();
  }

  function generarPagare() {
    if (!preview || !nombreCompleto.trim()) return;
    // Folio de solo números (más fácil de leer/dictar que uno alfanumérico).
    setFolio(String(Date.now()));
    setPagareGenerado(true);
  }

  function editarDatos() {
    setPagareGenerado(false);
    setFirmaCliente(null);
    setFirmaCobrador(null);
  }

  /**
   * Si ya se había generado el pagaré (y tal vez ya firmaron) y el cobrador
   * cambia algún dato del préstamo, ese pagaré ya no sirve — se invalida
   * (y se borran las firmas) para forzar a generarlo y firmarlo de nuevo con
   * los datos correctos. OJO: nunca se usa `disabled` en los campos del
   * formulario para "bloquearlos" después de generar el pagaré, porque un
   * input deshabilitado no manda su valor al enviar el formulario — en vez
   * de eso, cualquier cambio simplemente invalida el pagaré ya generado.
   */
  function invalidarPagareSiHacia() {
    if (pagareGenerado) editarDatos();
  }

  const hoy = new Date();
  const vencimientoEstimado = preview ? new Date(hoy.getTime() + preview.dias * 24 * 60 * 60 * 1000) : hoy;
  const ambasFirmasListas = !!firmaCliente && !!firmaCobrador;

  return (
    <form
      action={crearClienteYSolicitud}
      encType="multipart/form-data"
      className="space-y-5 bg-surface p-6 rounded-xl border border-border"
    >
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-strong flex items-center gap-1.5">
          <UserRound className="h-4 w-4 text-accent-text" />
          Datos del cliente
        </p>
        <div className="space-y-1">
          <label className="text-sm text-ink-secondary" htmlFor="nombre_completo">
            Nombre completo
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            required
            value={nombreCompleto}
            onChange={(e) => {
              setNombreCompleto(e.target.value);
              invalidarPagareSiHacia();
            }}
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="telefono">
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="direccion">
              Dirección
            </label>
            <input
              id="direccion"
              name="direccion"
              className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-ink-strong flex items-center gap-1.5">
          <Landmark className="h-4 w-4 text-accent-text" />
          Préstamo
        </p>
        <div className="space-y-1">
          <label className="text-sm text-ink-secondary" htmlFor="monto_solicitado">
            Valor del préstamo
          </label>
          <input
            id="monto_solicitado"
            name="monto_solicitado"
            type="number"
            min="1"
            step="0.01"
            required
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              invalidarPagareSiHacia();
            }}
            className="w-full max-w-xs rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="space-y-1">
          <p className="text-sm text-ink-secondary">Plan</p>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {([20, 30] as const).map((opcion) => (
              <label
                key={opcion}
                className="flex flex-col items-center gap-0.5 rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-sm text-ink-secondary has-[:checked]:border-amber-500 has-[:checked]:text-accent-text cursor-pointer"
              >
                <input
                  type="radio"
                  checked={tipoPlan === opcion}
                  onChange={() => {
                    setTipoPlan(opcion);
                    invalidarPagareSiHacia();
                  }}
                  className="accent-amber-500"
                />
                <span className="font-semibold">{opcion} días</span>
                <span className="text-xs">{calcularPorcentajeInteresPorPlan(opcion)}% total</span>
              </label>
            ))}
            <label className="flex flex-col items-center gap-0.5 rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-sm text-ink-secondary has-[:checked]:border-amber-500 has-[:checked]:text-accent-text cursor-pointer">
              <input
                type="radio"
                checked={tipoPlan === "personalizado"}
                onChange={() => {
                  setTipoPlan("personalizado");
                  invalidarPagareSiHacia();
                }}
                className="accent-amber-500"
              />
              <span className="font-semibold">Personalizado</span>
              <span className="text-xs">Tú pones el %</span>
            </label>
          </div>
          {tipoPlan === "personalizado" ? (
            <input type="hidden" name="plazo_dias" value={diasPersonalizado} />
          ) : (
            <input type="hidden" name="plazo_dias" value={tipoPlan} />
          )}
        </div>

        {tipoPlan === "personalizado" && (
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <div className="space-y-1">
              <label className="text-sm text-ink-secondary" htmlFor="dias_personalizado">
                Días del plazo
              </label>
              <input
                id="dias_personalizado"
                type="number"
                min="1"
                step="1"
                required
                value={diasPersonalizado}
                onChange={(e) => {
                  setDiasPersonalizado(e.target.value);
                  invalidarPagareSiHacia();
                }}
                className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink-secondary" htmlFor="porcentaje_personalizado">
                % de interés total
              </label>
              <input
                id="porcentaje_personalizado"
                name="porcentaje_interes_personalizado"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={porcentajePersonalizado}
                onChange={(e) => {
                  setPorcentajePersonalizado(e.target.value);
                  invalidarPagareSiHacia();
                }}
                className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        )}

        {preview ? (
          <div className="grid grid-cols-3 gap-3 bg-page border border-border rounded-lg p-3 text-sm max-w-md">
            <div>
              <p className="text-ink-muted text-xs">Interés total</p>
              <p className="font-semibold">
                {preview.porcentaje}% ({currency(preview.interes)})
              </p>
            </div>
            <div>
              <p className="text-ink-muted text-xs">Valor a pagar</p>
              <p className="font-semibold text-accent-text">{currency(preview.total)}</p>
            </div>
            <div>
              <p className="text-ink-muted text-xs">Pago diario</p>
              <p className="font-semibold">{currency(preview.pagoDiario)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            {tipoPlan === "personalizado"
              ? "Escribe el valor del préstamo, los días y el % para ver el total y el pago diario."
              : "Escribe el valor del préstamo para ver el total y el pago diario."}
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            name="personalizar_dias"
            checked={personalizarDias}
            onChange={(e) => {
              setPersonalizarDias(e.target.checked);
              invalidarPagareSiHacia();
            }}
            className="accent-amber-500"
          />
          <CalendarClock className="h-4 w-4 text-ink-muted shrink-0" />
          Este cliente va a pagar en días distintos a los normales (por ejemplo, fines de semana)
        </label>
        {personalizarDias && (
          <div className="space-y-2 pl-6">
            <p className="text-xs text-ink-muted">Marca los días en que SÍ se le va a cobrar a este cliente.</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => (
                <label
                  key={dia.valor}
                  className="flex items-center gap-1.5 rounded-md bg-surface-2 border border-border-strong px-2 py-1.5 text-xs text-ink-secondary has-[:checked]:border-amber-500 has-[:checked]:text-accent-text cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name={`dia_${dia.valor}`}
                    checked={diasElegidos.includes(dia.valor)}
                    onChange={() => alternarDia(dia.valor)}
                    className="accent-amber-500"
                  />
                  {dia.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-ink-strong flex items-center gap-1.5">
          <FileImage className="h-4 w-4 text-accent-text" />
          Documentos
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="doc_ine_frente">
              Foto del INE (frente)
            </label>
            <input
              id="doc_ine_frente"
              name="doc_ine_frente"
              type="file"
              accept="image/*"
              capture="environment"
              required
              className="w-full text-xs text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="doc_ine_reverso">
              Foto del INE (reverso)
            </label>
            <input
              id="doc_ine_reverso"
              name="doc_ine_reverso"
              type="file"
              accept="image/*"
              capture="environment"
              required
              className="w-full text-xs text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="doc_comprobante_domicilio">
              Comprobante de domicilio
            </label>
            <input
              id="doc_comprobante_domicilio"
              name="doc_comprobante_domicilio"
              type="file"
              accept="image/*"
              capture="environment"
              required
              className="w-full text-xs text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="doc_foto_cliente">
              Foto de la cara del cliente
            </label>
            <input
              id="doc_foto_cliente"
              name="doc_foto_cliente"
              type="file"
              accept="image/*"
              capture="user"
              required
              className="w-full text-xs text-ink-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-ink"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium text-ink-strong flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-accent-text" />
          Pagaré
        </p>

        <div className="space-y-1 max-w-xs">
          <label className="text-sm text-ink-secondary" htmlFor="lugar_firma">
            Lugar donde se firma
          </label>
          <input
            id="lugar_firma"
            name="lugar"
            value={lugar}
            onChange={(e) => {
              setLugar(e.target.value);
              invalidarPagareSiHacia();
            }}
            placeholder="Ej. Ciudad de México"
            className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {!pagareGenerado ? (
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">
              Llena el nombre del cliente y el préstamo de arriba, y genera el pagaré con esos datos ya llenos.
            </p>
            <button
              type="button"
              disabled={!preview || !nombreCompleto.trim()}
              onClick={generarPagare}
              className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed border border-border-strong text-ink font-medium text-sm px-3 py-1.5 rounded-md"
            >
              <FileText className="h-4 w-4" />
              Generar pagaré
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-page border border-border rounded-lg p-4 text-xs space-y-1 max-w-md">
              <p className="text-center font-bold text-sm mb-1">PAGARÉ · SIN PROTESTO</p>
              <p>
                <span className="text-ink-muted">Bueno por:</span> {currency(preview?.total ?? 0)}
              </p>
              <p>
                <span className="text-ink-muted">No.:</span> {folio}
              </p>
              <p>
                <span className="text-ink-muted">Fecha:</span> {fechaCorta(hoy)}
              </p>
              <p>
                <span className="text-ink-muted">Lugar:</span> {lugar || "—"}
              </p>
              <p>
                <span className="text-ink-muted">Cantidad $:</span> {currency(Number(monto))}
              </p>
              <p>
                <span className="text-ink-muted">Pagos diarios $:</span> {currency(preview?.pagoDiario ?? 0)}
              </p>
              <p>
                <span className="text-ink-muted">Interés moratorio % diario:</span> {interesMoratorioDiarioPagare}%
              </p>
              <p>
                <span className="text-ink-muted">Vencimiento (estimado):</span> {fechaCorta(vencimientoEstimado)}
              </p>
              <p className="pt-1 border-t border-border mt-1">
                <span className="text-ink-muted">Obligado suscriptor:</span> {nombreCompleto}
              </p>
              <p>
                <span className="text-ink-muted">Aval (cobrador):</span> {nombreCobrador}
              </p>
            </div>

            <button
              type="button"
              onClick={editarDatos}
              className="text-xs text-ink-muted hover:text-ink underline"
            >
              Editar datos (borra las firmas)
            </button>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm text-ink-secondary flex items-center gap-1.5">
                <PenLine className="h-4 w-4 text-accent-text" />
                Firmas
              </p>
              <p className="text-xs text-ink-muted">
                Pásale el celular o la tablet al cliente para que firme, y luego firma tú como aval.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <FirmaCanvas etiqueta="Firma del cliente (obligado suscriptor)" onChange={setFirmaCliente} />
                <FirmaCanvas etiqueta="Firma del cobrador (aval)" onChange={setFirmaCobrador} />
              </div>
              <input type="hidden" name="firma_cliente_data_url" value={firmaCliente ?? ""} />
              <input type="hidden" name="firma_cobrador_data_url" value={firmaCobrador ?? ""} />
              <input type="hidden" name="folio" value={folio} />
              {ambasFirmasListas && (
                <p className="text-xs text-accent-text flex items-center gap-1">
                  <CircleCheck className="h-3.5 w-3.5" />
                  Pagaré firmado por ambos. Ya puedes enviar la solicitud.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">{error}</p>
      )}

      <button
        disabled={!ambasFirmasListas}
        className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500 text-neutral-950 font-semibold rounded-md py-2 text-sm"
      >
        <CircleCheck className="h-4 w-4" />
        {ambasFirmasListas ? "Crear cliente y enviar a Empresa" : "Falta generar el pagaré y firmarlo"}
      </button>
    </form>
  );
}

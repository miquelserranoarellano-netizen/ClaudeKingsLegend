"use client";

import { ImagePlus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Selector de imagen que la reduce en el navegador antes de subirla (lado mayor ≤ `maxSize` px, WebP).
 * Así las subidas pesan poco y, al recodificarla, desaparecen los metadatos (ubicación GPS, cámara…).
 * El servidor vuelve a comprobar el tipo real y el tamaño.
 */
export function ImageInput({
  name,
  label,
  hint,
  maxSize = 1024,
  currentUrl,
  shape = "square",
  error,
}: {
  name: string;
  label: string;
  hint?: string;
  maxSize?: number;
  currentUrl?: string | null;
  shape?: "square" | "round" | "banner";
  error?: string;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setProblem(null);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setProblem("Elige una imagen PNG, JPEG o WebP.");
      input.value = "";
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
      if (!blob) throw new Error("No se pudo procesar la imagen");
      const resized = new File([blob], "imagen.webp", { type: blob.type });
      const transfer = new DataTransfer();
      transfer.items.add(resized);
      input.files = transfer.files;
      setPreview(URL.createObjectURL(resized));
    } catch {
      setProblem("No se ha podido leer la imagen. Prueba con otra.");
      input.value = "";
    } finally {
      setBusy(false);
    }
  }

  const frame = shape === "banner" ? "aspect-[16/7] w-full max-w-md" : "size-24";
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-line-strong bg-surface-2 text-ink-3",
            frame,
            shape === "round" ? "rounded-full" : "rounded-lg",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local
            <img src={preview} alt="Vista previa" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden className="size-6" />
          )}
        </div>
        <div className="space-y-1">
          <label
            htmlFor={id}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-2 focus-within:ring-2"
          >
            {busy ? "Procesando…" : preview ? "Cambiar imagen" : "Elegir imagen"}
          </label>
          <input id={id} name={name} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onChange} />
          {hint && <p className="text-xs text-ink-3">{hint}</p>}
        </div>
      </div>
      {(problem || error) && <p className="text-xs font-medium text-danger">{problem ?? error}</p>}
    </div>
  );
}

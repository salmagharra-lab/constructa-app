"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Shrink big phone photos before upload — important on weak site reception. */
async function compress(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function CompleteTask({ taskId, projectId }: { taskId: string; projectId: string }) {
  const t = useTranslations("task");
  const tw = useTranslations("worker");
  const tc = useTranslations("common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function openCamera() {
    setError(null);
    inputRef.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setFile(picked);
    setUploadedPath(null);
    setPreview(URL.createObjectURL(picked));
  }

  async function confirm() {
    if (!file) {
      setError(t("photoRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      let path = uploadedPath;
      if (!path) {
        const blob = await compress(file);
        const ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg");
        path = `${projectId}/${taskId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("task-photos")
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        setUploadedPath(path); // a retry won't upload twice
      }
      const { error: rpcErr } = await supabase.rpc("complete_task", { p_task: taskId, p_photo_path: path });
      if (rpcErr) throw rpcErr;
      router.refresh();
    } catch {
      setError(tw("sendError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
        aria-label={t("takePhoto")}
      />

      {!preview ? (
        <>
          <button onClick={openCamera} className="btn-primary btn-huge">
            {t("markDone")}
          </button>
          <p className="text-center text-sm text-stone-500">📷 {t("photoRequired")}</p>
        </>
      ) : (
        <div className="card space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={t("takePhoto")} className="max-h-[50vh] w-full rounded-xl object-contain" />
          <button onClick={confirm} disabled={busy} className="btn-primary btn-huge bg-green-600 text-white hover:bg-green-500">
            {busy ? t("uploading") : error ? `↻ ${tc("retry")}` : `✓ ${t("confirm")}`}
          </button>
          <button onClick={openCamera} disabled={busy} className="btn-ghost w-full">
            📷 {t("retake")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-base font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

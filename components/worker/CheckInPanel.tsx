"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseRpcError } from "@/lib/rpcErrors";
import { formatTime, hoursBetween } from "@/lib/time";

type Props = {
  projectId: string;
  projectName: string;
  address: string | null;
  openShift: { projectId: string; checkInAt: string } | null;
  otherProjectName: string | null;
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 2 });
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000,
    });
  });
}

export default function CheckInPanel({ projectId, projectName, address, openShift, otherProjectName }: Props) {
  const t = useTranslations("worker");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<null | "locating" | "sending">(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!openShift) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [openShift]);

  function explain(code: string, detail?: string) {
    switch (code) {
      case "outside_radius":
        return t("outsideRadius", { distance: detail ?? "?" });
      case "already_checked_in":
        return t("alreadyCheckedIn");
      case "not_checked_in":
        return t("notCheckedIn");
      default:
        return t("sendError");
    }
  }

  async function checkIn() {
    setError(null);
    setBusy("locating");
    let pos: GeolocationPosition;
    try {
      pos = await getPosition();
    } catch (e) {
      setBusy(null);
      setError((e as GeolocationPositionError)?.code === 1 ? t("locationDenied") : t("locationUnavailable"));
      return;
    }
    setBusy("sending");
    try {
      const { error } = await createClient().rpc("check_in", {
        p_project: projectId,
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
      });
      if (error) {
        const { code, detail } = parseRpcError(error.message);
        setError(explain(code, detail));
      } else router.refresh();
    } catch {
      setError(t("sendError"));
    } finally {
      setBusy(null);
    }
  }

  async function checkOut() {
    setError(null);
    setBusy("sending");
    try {
      const { error } = await createClient().rpc("check_out");
      if (error) setError(explain(parseRpcError(error.message).code));
      else router.refresh();
    } catch {
      setError(t("sendError"));
    } finally {
      setBusy(null);
    }
  }

  const onSite = openShift !== null;
  const hours = openShift ? hoursBetween(openShift.checkInAt, null, now) : 0;

  return (
    <section className={`card space-y-3 ${onSite ? "border-green-300 bg-green-50" : ""}`}>
      <div>
        <p className="text-lg font-bold">{otherProjectName ?? projectName}</p>
        {address && !otherProjectName && <p className="text-sm text-stone-500">{address}</p>}
      </div>
      <p className={`flex items-center gap-2 text-base font-semibold ${onSite ? "text-green-800" : "text-stone-500"}`}>
        <span className={`size-3 rounded-full ${onSite ? "animate-pulse bg-green-600" : "bg-stone-300"}`} aria-hidden />
        {onSite
          ? `${t("onSiteSince", { time: formatTime(openShift.checkInAt, locale) })} · ${Math.floor(hours)}:${String(
              Math.floor((hours % 1) * 60),
            ).padStart(2, "0")}`
          : t("notOnSite")}
      </p>

      {onSite ? (
        <button onClick={checkOut} disabled={busy !== null} className="btn-dark btn-huge">
          {busy ? "…" : `⏹ ${t("checkOut")}`}
        </button>
      ) : (
        <button onClick={checkIn} disabled={busy !== null} className="btn-primary btn-huge">
          {busy === "locating" ? t("gettingLocation") : busy === "sending" ? "…" : `📍 ${t("checkIn")}`}
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-base font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

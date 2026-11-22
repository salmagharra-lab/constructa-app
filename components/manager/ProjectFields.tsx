"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Project } from "@/lib/types";

/** Name/address/coordinates/radius inputs, with a "use my location" button. */
export default function ProjectFields({ project }: { project?: Project }) {
  const t = useTranslations("manager");
  const [lat, setLat] = useState(project ? String(project.lat) : "");
  const [lng, setLng] = useState(project ? String(project.lng) : "");
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">{t("name")}</label>
        <input name="name" required defaultValue={project?.name} className="input" />
      </div>
      <div>
        <label className="label">{t("address")}</label>
        <input name="address" defaultValue={project?.address ?? ""} className="input" />
      </div>
      <div>
        <label className="label">{t("lat")}</label>
        <input
          name="lat"
          required
          inputMode="decimal"
          dir="ltr"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="input"
          placeholder="32.0853"
        />
      </div>
      <div>
        <label className="label">{t("lng")}</label>
        <input
          name="lng"
          required
          inputMode="decimal"
          dir="ltr"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="input"
          placeholder="34.7818"
        />
      </div>
      <div>
        <label className="label">{t("radius")}</label>
        <input
          name="radius_m"
          type="number"
          min={20}
          max={5000}
          required
          defaultValue={project?.radius_m ?? 150}
          className="input"
        />
      </div>
      <div className="flex items-end">
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-ghost w-full">
          📍 {locating ? "…" : t("useMyLocation")}
        </button>
      </div>
    </div>
  );
}

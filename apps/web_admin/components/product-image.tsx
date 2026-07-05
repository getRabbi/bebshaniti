"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase-browser";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function validateProductImage(file: File) {
  return ALLOWED_TYPES.has(file.type) && file.size <= MAX_BYTES;
}

export async function uploadProductImage(file: File, organizationId: string) {
  if (!validateProductImage(file)) throw new Error("invalid-image");
  const extension = (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    } as Record<string, string>
  )[file.type];
  const path = `${organizationId}/products/${crypto.randomUUID()}.${extension}`;
  const { error } = await createClient()
    .storage.from("product-media")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
  if (error) throw error;
  return path;
}

export function ProductImagePicker({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="product-image-picker">
      <div className="product-image-preview">
        {preview ? (
          <Image src={preview} alt="" width={64} height={64} unoptimized />
        ) : (
          <span>{t("image")}</span>
        )}
      </div>
      <div>
        <label className="button secondary image-upload-button">
          {file ? t("replaceImage") : t("uploadImage")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              if (selected && !validateProductImage(selected)) {
                setError(t("invalidImage"));
                event.target.value = "";
                return;
              }
              setError("");
              onChange(selected);
            }}
          />
        </label>
        {file ? (
          <button
            type="button"
            className="link-button danger"
            onClick={() => onChange(null)}
          >
            {t("removeImage")}
          </button>
        ) : null}
        <small>{t("imageHint")}</small>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}

export function ProductImageManager({
  productId,
  imagePath,
  imageUrl,
  organizationId,
  token,
  canUpdate,
  onChanged,
}: {
  productId: string;
  imagePath?: string;
  imageUrl?: string;
  organizationId: string;
  token: string;
  canUpdate: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function replace(file: File) {
    if (!validateProductImage(file)) {
      setError(t("invalidImage"));
      return;
    }
    setSaving(true);
    setError("");
    let uploaded = "";
    try {
      uploaded = await uploadProductImage(file, organizationId);
      await apiRequest(`/products/${productId}/image`, token, organizationId, {
        method: "PATCH",
        body: JSON.stringify({ image_path: uploaded }),
      });
      if (imagePath)
        await createClient().storage.from("product-media").remove([imagePath]);
      await onChanged();
    } catch (caught) {
      if (uploaded)
        await createClient().storage.from("product-media").remove([uploaded]);
      setError(caught instanceof Error ? caught.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/products/${productId}/image`, token, organizationId, {
        method: "PATCH",
        body: JSON.stringify({ image_path: null }),
      });
      if (imagePath)
        await createClient().storage.from("product-media").remove([imagePath]);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="product-thumb-cell">
      <button
        type="button"
        className="product-thumb"
        disabled={!canUpdate || saving}
        onClick={() => input.current?.click()}
        title={canUpdate ? t("replaceImage") : t("noPermission")}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={64} height={64} unoptimized />
        ) : (
          <span>＋</span>
        )}
      </button>
      {canUpdate ? (
        <>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void replace(file);
              event.target.value = "";
            }}
          />
          {imagePath ? (
            <button
              type="button"
              className="thumb-remove"
              onClick={() => void remove()}
              disabled={saving}
              aria-label={t("removeImage")}
            >
              ×
            </button>
          ) : null}
        </>
      ) : null}
      {error ? <small className="thumb-error">{error}</small> : null}
    </div>
  );
}

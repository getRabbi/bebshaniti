"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export type PosCustomer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
};

export function PosCustomerSelector({
  customers,
  selectedId,
  onSelect,
  onCustomerCreated,
  accessToken,
  organizationId,
  canCreate,
  required,
  onDone,
}: {
  customers: PosCustomer[];
  selectedId: string;
  onSelect: (customerId: string) => void;
  onCustomerCreated: (customer: PosCustomer) => void;
  accessToken: string;
  organizationId: string;
  canCreate: boolean;
  required: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const listId = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = customers.find((item) => item.id === selectedId);
  const matches = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return customers.slice(0, 8);
    return customers
      .filter((customer) =>
        [customer.name, customer.phone].some((field) =>
          String(field ?? "")
            .toLocaleLowerCase()
            .includes(value),
        ),
      )
      .slice(0, 8);
  }, [customers, query]);

  useEffect(() => {
    if (createOpen) nameInput.current?.focus();
  }, [createOpen]);

  function choose(customer: PosCustomer) {
    onSelect(customer.id);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    onDone();
  }

  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const customer = await apiRequest<PosCustomer>(
        "/customers",
        accessToken,
        organizationId,
        {
          method: "POST",
          body: JSON.stringify({
            name: String(form.get("name") || "").trim(),
            phone: String(form.get("phone") || "").trim() || null,
            address: String(form.get("address") || "").trim() || null,
            customer_type: "retail",
            credit_limit: 0,
          }),
        },
      );
      onCustomerCreated(customer);
      setCreateOpen(false);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`pos-customer ${required && !selected ? "invalid" : ""}`}>
      <div className="pos-customer-heading">
        <span>{t("optionalCustomer")}</span>
        <button
          type="button"
          className="link-button"
          disabled={!canCreate}
          title={!canCreate ? t("customerCreatePermission") : undefined}
          onClick={() => {
            setError("");
            setCreateOpen(true);
          }}
        >
          + {t("addNewCustomer")}
        </button>
      </div>
      {selected ? (
        <div className="selected-customer" aria-live="polite">
          <span>
            <small>{t("selectedCustomer")}</small>
            <strong>{selected.name}</strong>
            {selected.phone ? <em>{selected.phone}</em> : null}
          </span>
          <button
            type="button"
            className="link-button danger"
            onClick={() => onSelect("")}
          >
            {t("clearCustomer")}
          </button>
        </div>
      ) : null}
      <div className="customer-combobox">
        <input
          role="combobox"
          aria-label={t("customerSearch")}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={t("customerSearchPlaceholder")}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={navigate}
        />
        {open ? (
          <div className="customer-options" id={listId} role="listbox">
            {matches.length ? (
              matches.map((customer, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={customer.id === selectedId}
                  className={index === activeIndex ? "active" : undefined}
                  key={customer.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(customer)}
                >
                  <strong>{customer.name}</strong>
                  <span>{customer.phone || "—"}</span>
                </button>
              ))
            ) : (
              <p>{t("noData")}</p>
            )}
          </div>
        ) : null}
      </div>
      {required && !selected ? (
        <p className="field-error" role="alert">
          {t("dueCustomerWarning")}
        </p>
      ) : null}

      {createOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="quick-customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-customer-title"
          >
            <div className="panel-header">
              <div>
                <h2 id="quick-customer-title">{t("quickCustomerTitle")}</h2>
                <p>{t("quickCustomerIntro")}</p>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label={t("cancel")}
                onClick={() => {
                  setCreateOpen(false);
                  onDone();
                }}
              >
                ×
              </button>
            </div>
            {error ? (
              <div className="error" role="alert">
                {error}
              </div>
            ) : null}
            <form onSubmit={createCustomer}>
              <label className="field">
                <span>{t("customerName")} *</span>
                <input ref={nameInput} name="name" required />
              </label>
              <label className="field">
                <span>{t("customerPhoneOptional")}</span>
                <input name="phone" inputMode="tel" />
              </label>
              <label className="field">
                <span>{t("customerAddressOptional")}</span>
                <input name="address" />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    onDone();
                  }}
                >
                  {t("cancel")}
                </button>
                <button className="button" disabled={saving}>
                  {saving ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

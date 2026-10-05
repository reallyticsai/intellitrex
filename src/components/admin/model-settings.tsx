"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle, KeyRound, Loader2, Plus, Settings2, X } from "lucide-react";
import type { PublicModelConfiguration } from "@/lib/server/model-configurations/types";

const API = "/api/admin/model-configurations";
const LOGIN = "/api/admin/model-settings/login";
const emptyForm = { name: "", baseUrl: "https://openrouter.ai/api/v1", modelId: "", apiKey: "" };
type ApiResult = { authenticated?: boolean; expiresAt?: number | null; configurations?: PublicModelConfiguration[]; message?: string; error?: { message?: string } };

class SettingsError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function api(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<ApiResult> {
  const response = await fetch(path, { method, credentials: "same-origin", cache: "no-store", signal,
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result: ApiResult = await response.json();
  if (!response.ok) throw new SettingsError(result.error?.message || "The request could not be completed.", response.status);
  return result;
}

const button = "rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

export function ModelSettings() {
  const [unlocked, setUnlocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [records, setRecords] = useState<PublicModelConfiguration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<PublicModelConfiguration | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: "delete" | "test"; record: PublicModelConfiguration } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const session = await api("/api/admin/model-settings/session", "GET", undefined, controller.signal);
        if (session.authenticated) {
          const data = await api(API, "GET", undefined, controller.signal);
          if (!controller.signal.aborted) { setRecords(data.configurations || []); setUnlocked(true); setExpiresAt(session.expiresAt || null); }
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load settings.");
      } finally { if (!controller.signal.aborted) setChecking(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const timeout = setTimeout(() => {
      setUnlocked(false); setRecords([]); setPassword(""); setForm(emptyForm);
      setEditing(null); setShowForm(false); setConfirmation(null); setExpiresAt(null);
      setNotice(null); setError("Your operator session expired. Unlock Model Settings again.");
    }, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [expiresAt]);

  function clearSecrets() {
    setPassword(""); setForm(emptyForm); setEditing(null); setShowForm(false); setConfirmation(null);
  }

  function handleFailure(failure: unknown) {
    setError(failure instanceof Error ? failure.message : "The request could not be completed.");
    if (failure instanceof SettingsError && failure.status === 401) {
      setUnlocked(false); setExpiresAt(null); setRecords([]); clearSecrets();
    }
  }

  async function unlock(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      const session = await api(LOGIN, "POST", { password });
      setPassword(""); setUnlocked(true); setExpiresAt(session.expiresAt || null);
      const data = await api(API); setRecords(data.configurations || []);
    } catch (failure) { handleFailure(failure); setPassword(""); }
    finally { setBusy(false); }
  }

  async function lock() {
    setBusy(true); setError(null); setNotice(null);
    try { await api(LOGIN, "DELETE"); setUnlocked(false); setExpiresAt(null); setRecords([]); clearSecrets(); }
    catch (failure) { handleFailure(failure); }
    finally { setBusy(false); }
  }

  async function mutate(operation: () => Promise<ApiResult>, message: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await operation();
      // A successful mutation must clear entered secrets even if the refresh fails.
      clearSecrets(); setNotice(result.message || message);
      const data = await api(API); setRecords(data.configurations || []);
    } catch (failure) { handleFailure(failure); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const { apiKey, ...connection } = form;
    await mutate(() => api(editing ? `${API}/${editing.id}` : API, editing ? "PATCH" : "POST", {
      ...connection, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    }), editing ? "Configuration saved. If connection details changed, test and activate it again." : "Configuration saved as inactive. Test it, then activate it when ready.");
  }

  const active = records.find((record) => record.isActive);
  const connectionChanged = editing?.isActive && (editing.baseUrl !== form.baseUrl || editing.modelId !== form.modelId || !!form.apiKey.trim());

  return (
    <section aria-labelledby="model-settings-heading" className="mx-auto my-8 max-w-7xl rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="model-settings-heading" className="flex items-center gap-2 text-xl font-semibold"><Settings2 className="h-5 w-5 text-primary" /> Model Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Save provider connections and choose the model used by the AI advisor.</p>
        </div>
        {unlocked && <button className={button} disabled={busy} onClick={lock}>Lock settings</button>}
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {notice && <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm"><CheckCircle className="h-4 w-4 shrink-0 text-success" />{notice}</div>}

      {checking ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking operator access…</p> : !unlocked ? (
        <form onSubmit={unlock} className="max-w-md space-y-3">
          <p className="text-sm text-muted-foreground">Unlock with your Model Settings operator password. This access is separate from the existing admin demo.</p>
          <label htmlFor="model-settings-password" className="block text-sm font-medium">Operator password</label>
          <input id="model-settings-password" className={field} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={1024} autoComplete="current-password" disabled={busy} />
          <button type="submit" className={`${button} bg-primary text-primary-foreground`} disabled={busy}><KeyRound className="mr-2 inline h-4 w-4" />{busy ? "Unlocking…" : "Unlock Model Settings"}</button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
            <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active model</p><p className="mt-1 font-medium">{active ? `${active.name} · ${active.modelId}` : "No active model — the AI advisor is unconfigured"}</p></div>
            <button className={button} disabled={busy} onClick={() => { clearSecrets(); setError(null); setNotice(null); setShowForm(true); }}><Plus className="mr-1 inline h-4 w-4" /> Add configuration</button>
          </div>

          {showForm && (
            <form onSubmit={save} className="rounded-xl border border-border p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{editing ? `Edit ${editing.name}` : "Add configuration"}</h3><button type="button" aria-label="Close configuration form" disabled={busy} onClick={clearSecrets} className={button}><X className="h-4 w-4" /></button></div>
              <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="model-config-name" className="mb-1 block text-sm font-medium">Display name</label><input id="model-config-name" className={field} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={100} placeholder="My OpenRouter connection" /></div>
                <div><label htmlFor="model-config-root" className="mb-1 block text-sm font-medium">Provider API root</label><select id="model-config-root" className={field} value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}><option value="https://openrouter.ai/api/v1">OpenRouter · https://openrouter.ai/api/v1</option><option value="https://api.openai.com/v1">OpenAI · https://api.openai.com/v1</option></select></div>
                <div><label htmlFor="model-config-model" className="mb-1 block text-sm font-medium">Model ID</label><input id="model-config-model" className={field} value={form.modelId} onChange={(event) => setForm({ ...form, modelId: event.target.value })} required maxLength={200} placeholder={form.baseUrl.includes("openrouter") ? "openai/gpt-4o-mini" : "gpt-4o-mini"} /><p className="mt-1 text-xs text-muted-foreground">Use the exact ID from your provider; OpenRouter IDs include the organization prefix.</p></div>
                <div><label htmlFor="model-config-key" className="mb-1 block text-sm font-medium">{editing ? "Replacement API key" : "API key"}</label><input id="model-config-key" className={field} type="password" autoComplete="off" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} required={!editing} maxLength={4096} placeholder={editing ? "Leave blank to keep the saved key" : "Enter your provider API key"} /><p className="mt-1 text-xs text-muted-foreground">Encrypted on the server; saved keys are never returned to this screen.</p></div>
              </fieldset>
              {connectionChanged && <p role="status" className="mt-4 text-sm text-yellow-600">Saving these connection changes deactivates this model. Test and activate it again before using the advisor.</p>}
              <div className="mt-4 flex gap-2"><button type="submit" disabled={busy} className={`${button} bg-primary text-primary-foreground`}>{busy ? "Saving…" : "Save configuration"}</button><button type="button" disabled={busy} className={button} onClick={clearSecrets}>Cancel</button></div>
            </form>
          )}

          {records.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No configurations saved yet. Add your first provider connection to get started.</p>}
          <ul className="space-y-3">
            {records.map((record) => (
              <li key={record.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{record.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${record.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{record.isActive ? "Active" : "Inactive"}</span><span className="text-xs text-muted-foreground">{record.hasApiKey ? "Key saved" : "Key missing"}</span></div>
                <p className="mt-2 break-all text-sm">{record.modelId}</p><p className="break-all text-xs text-muted-foreground">{record.baseUrl}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={button} disabled={busy} onClick={() => { setEditing(record); setForm({ name: record.name, baseUrl: record.baseUrl, modelId: record.modelId, apiKey: "" }); setShowForm(true); setConfirmation(null); setError(null); setNotice(null); }}>Edit</button>
                  <button className={button} disabled={busy} onClick={() => setConfirmation({ action: "test", record })}>Test connection</button>
                  <button className={button} disabled={busy || record.isActive} onClick={() => void mutate(() => api(`${API}/${record.id}/activate`, "POST"), `${record.name} is now the active model.`)}>Activate</button>
                  <button className={`${button} text-danger`} disabled={busy || record.isActive} title={record.isActive ? "Activate a replacement before deleting this model" : undefined} onClick={() => setConfirmation({ action: "delete", record })}>Delete</button>
                </div>
                {record.isActive && <p className="mt-2 text-xs text-muted-foreground">Activate a replacement before deleting this configuration.</p>}
              </li>
            ))}
          </ul>
          {confirmation && <div role="group" aria-label="Confirm model action" className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">{confirmation.action === "test" ? `Test ${confirmation.record.name}? This sends a small request to the provider and may incur charges. It does not activate the model.` : `Delete ${confirmation.record.name}? This removes its saved connection and key from the app. It does not revoke the key at the provider.`}</p>
            <div className="mt-3 flex gap-2"><button className={button} disabled={busy} onClick={() => void mutate(() => api(`${API}/${confirmation.record.id}${confirmation.action === "test" ? "/test" : ""}`, confirmation.action === "test" ? "POST" : "DELETE"), confirmation.action === "test" ? "Connection successful." : "Configuration deleted.")}>{busy ? "Working…" : confirmation.action === "test" ? "Run test" : "Confirm deletion"}</button><button className={button} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div>
          </div>}
          {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Updating model settings…</p>}
        </div>
      )}
    </section>
  );
}

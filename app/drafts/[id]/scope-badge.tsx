"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateScope } from "./actions";
import { Button } from "@/app/components/ui/button";
import { Input, Label } from "@/app/components/ui/input";
import { Eyebrow } from "@/app/components/ui/card";
import { Pill } from "@/app/components/ui/pill";
import type { Scope } from "@/lib/types";

const emptyScope: Scope = { products: [], version: null, summary: "" };

export function ScopeBadge({
  draftId,
  scope,
  editable = false,
}: {
  draftId: string;
  scope: Scope | null;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ScopeEditor
        draftId={draftId}
        initial={scope ?? emptyScope}
        onClose={() => setEditing(false)}
      />
    );
  }

  const hasContent =
    scope !== null && (scope.products.length > 0 || scope.version !== null);

  if (scope === null || !hasContent) {
    return (
      <div className="group flex items-center gap-3 rounded-lg border border-line bg-elev-1/40 px-4 py-2.5">
        <Eyebrow>ServiceNow scope</Eyebrow>
        <span className="flex-1 text-xs text-ink-4">— none detected</span>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-4 opacity-0 transition-all hover:text-ink group-hover:opacity-100"
          >
            edit
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group rounded-lg border border-line bg-elev-1/40 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Eyebrow>ServiceNow scope</Eyebrow>
        {scope.version && <Pill tone="info">{scope.version}</Pill>}
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-4 opacity-0 transition-all hover:text-ink group-hover:opacity-100"
          >
            edit
          </button>
        )}
      </div>
      {scope.summary && (
        <p className="text-sm leading-relaxed text-ink-2">{scope.summary}</p>
      )}
      {scope.products.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {scope.products.map((p, i) => (
            <Pill key={i} tone="brand">
              {p.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeEditor({
  draftId,
  initial,
  onClose,
}: {
  draftId: string;
  initial: Scope;
  onClose: () => void;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<string[]>(
    initial.products.map((p) => p.name),
  );
  const [version, setVersion] = useState(initial.version ?? "");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addProduct(name: string) {
    const v = name.trim();
    if (!v) return;
    if (products.some((p) => p.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    setProducts((xs) => [...xs, v]);
    setDraft("");
  }

  function removeProduct(i: number) {
    setProducts((xs) => xs.filter((_, j) => j !== i));
  }

  function save() {
    setError(null);
    const next: Scope | null =
      products.length === 0 && version.trim() === ""
        ? { products: [], version: null, summary: "" }
        : {
            products: products.map((name) => ({ name })),
            version: version.trim() || null,
            summary: initial.summary,
          };

    startTransition(async () => {
      const res = await updateScope(draftId, next);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-line-2 bg-elev-1 p-4">
      <Eyebrow className="mb-3">Edit ServiceNow scope</Eyebrow>

      <div className="space-y-2">
        <Label>Version</Label>
        <Input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="e.g. Vancouver, Washington — leave blank if unspecified"
          disabled={pending}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label>Products / modules</Label>
        {products.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {products.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(39,182,129,0.3)] bg-[rgba(39,182,129,0.08)] px-2 py-0.5 font-display text-[11px] font-medium uppercase tracking-[0.1em] text-teal"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removeProduct(i)}
                  disabled={pending}
                  className="text-teal/70 hover:text-danger"
                  aria-label={`Remove ${p}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addProduct(draft);
            }
          }}
          onBlur={() => addProduct(draft)}
          placeholder="Add a product (Enter or comma to add)"
          disabled={pending}
        />
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={pending}
          size="sm"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

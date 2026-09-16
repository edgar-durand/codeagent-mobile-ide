import type { ReactNode } from 'react';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettingsSnapshot } from '@codeam/ide-core';

interface EditorSettingsFormProps {
  settings: EditorSettingsSnapshot;
  onChange: (patch: Partial<EditorSettingsSnapshot>) => void;
}

export function EditorSettingsForm({ settings, onChange }: EditorSettingsFormProps) {
  return (
    <Section title="Editor">
      <Field label="Font size">
        <input
          type="number"
          min={8}
          max={32}
          value={settings.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) || DEFAULT_EDITOR_SETTINGS.fontSize })}
          className="w-20 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:border-violet-500/50"
        />
      </Field>
      <Field label="Tab size">
        <input
          type="number"
          min={1}
          max={8}
          value={settings.tabSize}
          onChange={(e) => onChange({ tabSize: Number(e.target.value) || DEFAULT_EDITOR_SETTINGS.tabSize })}
          className="w-20 bg-gray-900/70 border border-gray-700/60 rounded-md px-2 py-1 text-[12px] text-gray-200 focus:outline-none focus:border-violet-500/50"
        />
      </Field>
      <Toggle
        label="Word wrap"
        on={settings.wordWrap}
        onChange={(v) => onChange({ wordWrap: v })}
      />
      <Toggle
        label="Minimap"
        on={settings.minimap}
        onChange={(v) => onChange({ minimap: v })}
      />
      <Toggle
        label="Line numbers"
        on={settings.lineNumbers}
        onChange={(v) => onChange({ lineNumbers: v })}
      />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      <div className="flex flex-col gap-2 pl-1">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12px] text-gray-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 text-[12px] text-gray-300 hover:text-gray-100 transition-colors"
    >
      <span>{label}</span>
      <span
        className="relative inline-block w-9 h-5 rounded-full transition-colors"
        style={{ backgroundColor: on ? '#8b5cf6' : '#374151', padding: 2 }}
        aria-hidden="true"
      >
        <span
          className="block w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}

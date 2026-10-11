import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, FileText, ImagePlus, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOC_SLOTS, neededKinds, type AccountType, type DocKind, type PickedDoc } from '@/lib/coreDocuments';

// Ordering a service that registers a number to someone (e.g. IP Number & SMS Service):
// the account type, and the NID card (both sides), plus an organization's trade licence.
// Photos are made smaller here before they are sent; CORE keeps them privately.

const ACCOUNTS: { value: AccountType; label: string; needs: string; icon: typeof User }[] = [
  { value: 'individual', label: 'ব্যক্তিগত', needs: 'এনআইডি কার্ড (দুই পাশ)', icon: User },
  { value: 'organization', label: 'প্রতিষ্ঠান', needs: 'এনআইডি কার্ড (দুই পাশ) + ট্রেড লাইসেন্স', icon: Building2 },
];

const MAX_PDF = 2 * 1024 * 1024;
const MAX_TOTAL = 3 * 1024 * 1024;

const base64Of = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** A photo at most 1600 px on its long side, as JPEG; a PDF as it is (up to 2 MB). */
async function prepare(kind: DocKind, file: File): Promise<PickedDoc> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF) throw new Error('PDF ফাইলটা ২ MB-এর কম হতে হবে। ছবি তুলে দিতে পারেন।');
    return { kind, name: file.name, type: file.type, data: await base64Of(file), preview: null, size: file.size };
  }
  if (!file.type.startsWith('image/')) throw new Error('শুধু ছবি (JPG, PNG) বা PDF দিন।');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('এই ছবিটা খোলা যাচ্ছে না। JPG বা PNG ছবি দিন।');
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('এই ছবিটা খোলা যাচ্ছে না। JPG বা PNG ছবি দিন।');
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { kind, name, type: 'image/jpeg', data: await base64Of(blob), preview: URL.createObjectURL(blob), size: blob.size };
}

function Slot({
  label,
  doc,
  onPick,
  onRemove,
}: {
  label: string;
  doc: PickedDoc | undefined;
  onPick: (file: File) => Promise<void>;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-semibold">
        {label} <span className="text-red-600">*</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            await onPick(file);
          } finally {
            setBusy(false);
          }
        }}
      />
      {doc ? (
        <div className="relative overflow-hidden rounded-xl border-2 border-teal-600 bg-teal-50/40 dark:bg-teal-950/30">
          {doc.preview ? (
            <img src={doc.preview} alt={label} className="h-32 w-full object-contain" />
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-1 text-teal-700 dark:text-teal-300">
              <FileText className="h-8 w-8" />
              <span className="max-w-full truncate px-3 text-xs">{doc.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t bg-background/90 px-3 py-1.5 text-xs">
            <button type="button" onClick={() => input.current?.click()} className="font-semibold text-teal-700 hover:underline dark:text-teal-300">
              বদলান
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`${label} সরান`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex h-[170px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-teal-600 hover:bg-teal-50/50 hover:text-teal-700 disabled:opacity-60 dark:hover:bg-teal-950/30"
        >
          <ImagePlus className="h-7 w-7" />
          <span className="text-sm font-semibold">{busy ? 'প্রস্তুত হচ্ছে…' : 'ছবি তুলুন বা বেছে নিন'}</span>
          <span className="text-[11px]">JPG, PNG বা PDF</span>
        </button>
      )}
    </div>
  );
}

export default function CoreDocumentsStep({
  number,
  account,
  onAccount,
  docs,
  onDocs,
}: {
  number: string;
  account: AccountType | '';
  onAccount: (value: AccountType) => void;
  docs: Partial<Record<DocKind, PickedDoc>>;
  onDocs: (next: Partial<Record<DocKind, PickedDoc>>) => void;
}) {
  // Photos are prepared one by one, and may finish after another was picked: each change
  // starts from the latest documents, not the ones seen when it began.
  const latest = useRef(docs);
  useEffect(() => {
    latest.current = docs;
  }, [docs]);
  const update = (next: Partial<Record<DocKind, PickedDoc>>) => {
    latest.current = next;
    onDocs(next);
  };
  const remove = (kind: DocKind) => {
    const next = { ...latest.current };
    if (next[kind]?.preview) URL.revokeObjectURL(next[kind]!.preview!);
    delete next[kind];
    update(next);
  };
  const pick = async (kind: DocKind, file: File) => {
    try {
      const doc = await prepare(kind, file);
      const current = latest.current;
      const others = Object.values(current).filter((d) => d && d.kind !== kind) as PickedDoc[];
      if (others.reduce((sum, d) => sum + d.size, doc.size) > MAX_TOTAL) {
        if (doc.preview) URL.revokeObjectURL(doc.preview);
        throw new Error('ফাইলগুলো একসাথে বেশি বড়। PDF-এর বদলে ছবি দিন।');
      }
      if (current[kind]?.preview) URL.revokeObjectURL(current[kind]!.preview!);
      update({ ...current, [kind]: doc });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section id="core-documents">
      <h4 className="mb-1 font-bold">{number}. অ্যাকাউন্টের ধরন ও কাগজপত্র</h4>
      <p className="mb-3 text-xs text-muted-foreground">নম্বর রেজিস্ট্রেশনের জন্য লাগবে · শুধু CORE Automation দেখতে পাবে</p>
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="অ্যাকাউন্টের ধরন">
        {ACCOUNTS.map((a) => {
          const on = account === a.value;
          const Icon = a.icon;
          return (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onAccount(a.value)}
              className={cn(
                'flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all',
                on ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40' : 'hover:border-teal-600/50',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  on ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{a.label} অ্যাকাউন্ট</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">লাগবে: {a.needs}</span>
              </span>
            </button>
          );
        })}
      </div>
      {account && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {DOC_SLOTS.filter((s) => neededKinds(account).includes(s.kind)).map((s) => (
            <Slot
              key={s.kind}
              label={s.label}
              doc={docs[s.kind]}
              onPick={(file) => pick(s.kind, file)}
              onRemove={() => remove(s.kind)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

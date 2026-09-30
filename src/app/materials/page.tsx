"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Download, FileText, Library, Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase/client";

type Material = { id: string; section: string; topic: string; name: string; size: number; url: string };

const ALL_SECTIONS = ["All", "VARC", "DILR", "QA"] as const;
type FilterSection = (typeof ALL_SECTIONS)[number];

const sectionColors: Record<string, { icon: string; iconBg: string; dl: string }> = {
  VARC:  { icon: "bg-purple-50 text-purple-600", iconBg: "bg-purple-50", dl: "bg-purple-600 hover:bg-purple-700" },
  DILR:  { icon: "bg-emerald-50 text-emerald-600", iconBg: "bg-emerald-50", dl: "bg-emerald-600 hover:bg-emerald-700" },
  QA:    { icon: "bg-blue-50 text-blue-600", iconBg: "bg-blue-50", dl: "bg-blue-600 hover:bg-blue-700" },
  default: { icon: "bg-brand-tint text-brand-darker", iconBg: "bg-brand-tint", dl: "bg-brand hover:bg-brand-dark" },
};

const formatSize = (bytes: number) =>
  bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState<FilterSection>("All");
  const router = useRouter();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (user) return;
    const requireLogin = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a[aria-label^='Download']");
      if (!link) return;
      event.preventDefault();
      router.push("/login");
    };
    document.addEventListener("click", requireLogin);
    return () => document.removeEventListener("click", requireLogin);
  }, [router, user]);

  useEffect(() => {
    getDocs(query(collection(db, "materials"), where("published", "==", true)))
      .then((snap) => setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Material)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeSection === "All"
    ? materials
    : materials.filter((m) => m.section === activeSection);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-tint text-brand-darker">
              <Library size={18} />
            </span>
            <h1 className="font-display text-[24px] font-bold text-foreground">Study Materials</h1>
          </div>
          <p className="mt-1 text-[13.5px] text-muted ml-12">
            Notes, formula sheets, previous year papers and more.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {ALL_SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                activeSection === s
                  ? "bg-brand text-white shadow-md shadow-brand/25"
                  : "border border-border bg-white text-muted hover:border-brand hover:text-brand-darker"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Materials grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-brand" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Library size={32} className="mx-auto mb-3 text-muted" />
            <p className="text-[14px] font-semibold text-foreground">No materials yet</p>
            <p className="mt-1 text-[13px] text-muted">Materials are added regularly.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((material) => {
              const style = sectionColors[material.section] || sectionColors.default;
              return (
                <div key={material.id} className="edu-card p-4 flex flex-col">
                  <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${style.icon}`}>
                    <FileText size={20} />
                  </div>
                  <p className="text-[14px] font-semibold text-foreground leading-snug mb-1 flex-1">
                    {material.name}
                  </p>
                  <p className="text-[12px] text-muted mb-3">
                    {material.section} · {material.topic} · {formatSize(material.size)}
                  </p>
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Download ${material.name}`}
                    className={`flex w-full items-center justify-center gap-2 rounded-full py-2 text-[13px] font-semibold text-white transition ${style.dl}`}
                  >
                    <Download size={14} /> Download
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

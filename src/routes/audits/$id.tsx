import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { 
  ClipboardCheck, CheckCircle2, AlertTriangle, HelpCircle, 
  ChevronLeft, Save, Search, RefreshCw, CheckCircle, AlertOctagon 
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/audits/$id")({
  head: () => ({
    meta: [
      { title: "Auditor Session — AssetFlow" },
      { name: "description", content: "Interactive auditor interface to scan and log asset conditions." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AuditorSessionPage />
    </ProtectedRoute>
  ),
});

interface ScopedAsset {
  asset: {
    id: number;
    name: string;
    asset_tag: string;
    serial_number: string | null;
    location: string | null;
    condition: string;
    status: string;
  };
  is_audited: boolean;
  result: "verified" | "missing" | "damaged" | null;
  notes: string | null;
}

interface CycleDetails {
  id: number;
  scope_department_id: number | null;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  completion_percentage: number;
  assets_in_scope: ScopedAsset[];
}

function AuditorSessionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [cycle, setCycle] = useState<CycleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Scanned / Form values
  const [notesMap, setNotesMap] = useState<Record<number, string>>({});
  const [activeAssetId, setActiveAssetId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<"all" | "pending" | "audited">("all");

  const loadCycle = async () => {
    try {
      setLoading(true);
      const data = await api<CycleDetails>(`/api/audits/cycles/${id}`);
      setCycle(data);
      
      // Initialize notes maps
      const notes: Record<number, string> = {};
      data.assets_in_scope.forEach((sa) => {
        notes[sa.asset.id] = sa.notes || "";
      });
      setNotesMap(notes);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/auth" });
      return;
    }
    setUser(u);
    loadCycle();
  }, [navigate, id]);

  const handleSubmitRecord = async (assetId: number, result: "verified" | "missing" | "damaged") => {
    try {
      const notes = notesMap[assetId] || "";
      await api("/api/audits/records", {
        method: "POST",
        body: JSON.stringify({
          audit_cycle_id: parseInt(id),
          asset_id: assetId,
          result,
          notes
        })
      });
      toast.success(`Asset record saved as ${result}!`);
      loadCycle();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!cycle) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  const filteredAssets = cycle.assets_in_scope.filter((sa) => {
    const matchesSearch = 
      sa.asset.name.toLowerCase().includes(searchText.toLowerCase()) ||
      sa.asset.asset_tag.toLowerCase().includes(searchText.toLowerCase());
      
    if (!matchesSearch) return false;
    if (filterType === "pending") return !sa.is_audited;
    if (filterType === "audited") return sa.is_audited;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        
        {/* Back link */}
        <Link
          to="/audits"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Cycles
        </Link>

        {/* Cycle header card */}
        <section className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.02] to-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <span className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-widest">
                Active Auditor Session
              </span>
              <h1 className="text-2xl font-bold text-foreground mt-1">
                Audit Cycle #{cycle.id} Details
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Location scope: <span className="font-semibold text-foreground">{cycle.scope_location || "All locations"}</span>
              </p>
            </div>
            
            <div className="w-full md:w-64">
              <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1.5">
                <span>Cycle Completion</span>
                <span>{cycle.completion_percentage}%</span>
              </div>
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-500" 
                  style={{ width: `${cycle.completion_percentage}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by tag, name..."
              className="input pl-9 w-full text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "pending", "audited"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer ${
                  filterType === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {t} ({
                  cycle.assets_in_scope.filter((sa) => {
                    if (t === "pending") return !sa.is_audited;
                    if (t === "audited") return sa.is_audited;
                    return true;
                  }).length
                })
              </button>
            ))}
          </div>
        </div>

        {/* Assets verification list */}
        {filteredAssets.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center shadow-sm">
            <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No assets found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No assets in scope match your current search/filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssets.map(({ asset, is_audited, result, notes }) => (
              <div 
                key={asset.id} 
                className={`rounded-2xl border p-5 bg-card transition-all shadow-sm ${
                  is_audited ? "border-emerald-500/20 bg-emerald-500/[0.01]" : "border-border"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm font-bold text-primary">{asset.asset_tag}</span>
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        is_audited 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                      }`}>
                        {is_audited ? `Audited: ${result}` : "Pending Scan"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground">{asset.name}</h3>
                    <div className="mt-2 grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-muted-foreground">
                      <div>Serial: <span className="font-semibold text-foreground">{asset.serial_number || "—"}</span></div>
                      <div>Expected Loc: <span className="font-semibold text-foreground">{asset.location || "—"}</span></div>
                      <div>Condition: <span className="font-semibold text-foreground capitalize">{asset.condition}</span></div>
                      <div>Status: <span className="font-semibold text-foreground capitalize">{asset.status.replace("_", " ")}</span></div>
                    </div>
                  </div>

                  {/* Audit Actions Panel */}
                  <div className="w-full md:w-[320px] pt-4 border-t border-border md:pt-0 md:border-t-0 md:pl-4 flex flex-col gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verification notes</label>
                      <input
                        type="text"
                        value={notesMap[asset.id] || ""}
                        onChange={(e) => setNotesMap({ ...notesMap, [asset.id]: e.target.value })}
                        placeholder="Add inspection notes here..."
                        className="input mt-1 w-full text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleSubmitRecord(asset.id, "verified")}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 py-2 text-xs font-semibold transition-colors cursor-pointer border border-emerald-500/20"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Verify
                      </button>
                      <button
                        onClick={() => handleSubmitRecord(asset.id, "damaged")}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 py-2 text-xs font-semibold transition-colors cursor-pointer border border-orange-500/20"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Damage
                      </button>
                      <button
                        onClick={() => handleSubmitRecord(asset.id, "missing")}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 text-xs font-semibold transition-colors cursor-pointer border border-red-500/20"
                      >
                        <AlertOctagon className="h-3.5 w-3.5" />
                        Missing
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
      <style>{`
        .input {
          border: 1px solid var(--color-border);
          background: var(--color-background);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: var(--color-foreground);
          outline: none;
        }
        .input:focus {
          border-color: var(--color-ring);
        }
      `}</style>
    </div>
  );
}

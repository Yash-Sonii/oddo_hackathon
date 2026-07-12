import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { 
  Wrench, Play, CheckCircle2, AlertCircle, Clock, 
  Search, Plus, ClipboardEdit, UserPlus, Trash2, Calendar, DollarSign,
  Upload, Image as ImageIcon, CheckSquare, Square, Layers, History, LayoutGrid
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/maintenance/")({
  head: () => ({
    meta: [
      { title: "Maintenance Management — AssetFlow" },
      { name: "description", content: "Create, assign, resolve and track equipment maintenance requests." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <MaintenancePage />
    </ProtectedRoute>
  ),
});

interface MaintenanceRequest {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  raised_by_name: string;
  raised_by_email: string | null;
  issue_description: string;
  priority: string;
  photo_url: string | null;
  status: string;
  technician_name: string | null;
  cost: number;
  created_at: string;
}

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  status: string;
  condition: string;
}

function MaintenancePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: grid vs timeline
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<MaintenanceRequest | null>(null);

  // Form states
  const [newAssetId, setNewAssetId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newCost, setNewCost] = useState("0.0");
  const [newAttachment, setNewAttachment] = useState<string | null>(null);
  const [techName, setTechName] = useState("");
  const [resolveCost, setResolveCost] = useState("0.0");

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (priorityFilter) params.append("priority", priorityFilter);

      const [reqData, assetData] = await Promise.all([
        api<MaintenanceRequest[]>(`/api/maintenance?${params.toString()}`),
        api<Asset[]>("/api/assets")
      ]);
      setRequests(reqData);
      setAssets(assetData.filter(a => a.status !== "retired" && a.status !== "disposed"));
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
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, search, statusFilter, priorityFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAttachment(reader.result as string);
        toast.success("Attachment file parsed successfully!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetId || !newDescription) {
      toast.error("Please select an asset and write an issue description.");
      return;
    }
    try {
      await api("/api/maintenance", {
        method: "POST",
        body: JSON.stringify({
          asset_id: parseInt(newAssetId),
          issue_description: newDescription,
          priority: newPriority,
          photo_url: newAttachment,
          cost: parseFloat(newCost) || 0.0
        })
      });
      toast.success("Maintenance request raised successfully!");
      setIsCreateOpen(false);
      setNewAssetId("");
      setNewDescription("");
      setNewPriority("medium");
      setNewCost("0.0");
      setNewAttachment(null);
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !techName.trim()) {
      toast.error("Please specify a technician name.");
      return;
    }
    try {
      await api(`/api/maintenance/${selectedReq.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ technician_name: techName })
      });
      toast.success("Technician assigned!");
      setIsAssignOpen(false);
      setTechName("");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    try {
      await api(`/api/maintenance/${selectedReq.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "resolved",
          cost: parseFloat(resolveCost) || 0.0
        })
      });
      toast.success("Maintenance resolved successfully!");
      setIsResolveOpen(false);
      setResolveCost("0.0");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api(`/api/maintenance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      toast.success(`Request status set to ${status.replace("_", " ")}`);
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this maintenance request?")) return;
    try {
      await api(`/api/maintenance/${id}`, { method: "DELETE" });
      toast.success("Maintenance request deleted");
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Bulk Actions Handlers
  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      await Promise.all(
        selectedIds.map(id => 
          api(`/api/maintenance/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status })
          })
        )
      );
      toast.success(`Batch processed successfully for ${selectedIds.length} requests.`);
      setSelectedIds([]);
      loadData();
    } catch (e) {
      toast.error("Failed to update status on some requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} requests?`)) return;
    try {
      setLoading(true);
      await Promise.all(selectedIds.map(id => api(`/api/maintenance/${id}`, { method: "DELETE" })));
      toast.success("Batch requests deleted successfully.");
      setSelectedIds([]);
      loadData();
    } catch (e) {
      toast.error("Failed to delete some requests.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map(r => r.id));
    }
  };

  const toggleSelectRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Compute Technician Workloads
  const workloads: Record<string, number> = {};
  requests.forEach(r => {
    if (r.technician_name && r.status !== "resolved" && r.status !== "rejected") {
      workloads[r.technician_name] = (workloads[r.technician_name] || 0) + 1;
    }
  });

  const getStatusBadgeClass = (s: string) => {
    switch (s.toLowerCase()) {
      case "pending": return "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
      case "approved": return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "rejected": return "bg-destructive/10 text-destructive border border-destructive/20";
      case "assigned": return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "in_progress": return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
      case "resolved": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      default: return "bg-secondary text-secondary-foreground border border-border";
    }
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p.toLowerCase()) {
      case "critical": return "text-red-500 font-extrabold uppercase animate-pulse tracking-wide flex items-center gap-1";
      case "high": return "text-destructive font-semibold";
      case "medium": return "text-yellow-600 dark:text-yellow-400 font-semibold";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        
        {/* Header section */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Maintenance Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor, schedule, and approve physical asset maintenance.
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border p-1 bg-card">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Table View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setViewMode("timeline")}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "timeline" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Timeline View"
              >
                <History className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              Raise Request
            </button>
          </div>
        </div>

        {/* Dashboard summary widgets */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pending Requests</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">
                {requests.filter(r => r.status === "pending").length}
              </span>
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">In Progress</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">
                {requests.filter(r => r.status === "in_progress" || r.status === "assigned").length}
              </span>
              <Wrench className="h-6 w-6 text-orange-500" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Resolved (All Time)</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">
                {requests.filter(r => r.status === "resolved").length}
              </span>
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Cost Summarized</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">
                ${requests.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(2)}
              </span>
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Technician workload & Filters container */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Filters card */}
          <section className="lg:col-span-3 rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Search issues</label>
                <div className="relative mt-1">
                  <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tag, description..."
                    className="input pl-9 w-full text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workflow status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input mt-1 w-full text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="assigned">Technician Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Priority level</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="input mt-1 w-full text-sm"
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </section>

          {/* Technician workload sidebar */}
          <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
              <Layers className="h-4 w-4 text-primary" />
              Active Technician Load
            </h3>
            {Object.keys(workloads).length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No active assignments</p>
            ) : (
              <div className="space-y-2 max-h-24 overflow-y-auto">
                {Object.entries(workloads).map(([tech, count]) => (
                  <div key={tech} className="flex justify-between items-center text-xs font-medium border-b border-border/50 pb-1">
                    <span>{tech}</span>
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 font-bold">{count} tasks</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        {/* Requests Render */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
            <span>Loading maintenance records...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center shadow-sm">
            <Wrench className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No maintenance requests</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filters or raise a new request above.
            </p>
          </div>
        ) : viewMode === "timeline" ? (
          /* Chronological Timeline View */
          <div className="relative border-l border-border pl-6 ml-4 space-y-8 py-4">
            {requests.map((r) => (
              <div key={r.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground font-bold shadow-sm">
                  ✓
                </span>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm max-w-2xl">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{new Date(r.created_at).toLocaleDateString()}</span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">{r.asset_name} ({r.asset_tag})</h4>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.issue_description}</p>
                    </div>
                    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${getStatusBadgeClass(r.status)}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  {r.photo_url && (
                    <div className="mt-3">
                      <img src={r.photo_url} alt="Evidence attachment" className="h-16 rounded border border-border object-cover" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Standard Grid / Table View with Checkboxes for Bulk Action */
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-xs uppercase font-bold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground cursor-pointer">
                      {selectedIds.length === requests.length ? (
                        <CheckSquare className="h-4.5 w-4.5 text-primary" />
                      ) : (
                        <Square className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Issue Description</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Reporter</th>
                  <th className="px-6 py-4">Assigned Tech</th>
                  <th className="px-6 py-4">Cost</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className={`hover:bg-muted/20 transition-colors ${selectedIds.includes(r.id) ? "bg-primary/[0.02]" : ""}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button onClick={() => toggleSelectRow(r.id)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                        {selectedIds.includes(r.id) ? (
                          <CheckSquare className="h-4.5 w-4.5 text-primary" />
                        ) : (
                          <Square className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        {r.asset_name}
                        {r.photo_url && (
                          <span title="Has attachment">
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{r.asset_tag}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={r.issue_description}>
                      {r.issue_description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getPriorityBadgeClass(r.priority)}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {r.raised_by_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {r.technician_name || (
                        <span className="text-xs italic text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-foreground">
                      ${(r.cost || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${getStatusBadgeClass(r.status)}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                      {user && ["admin", "asset_manager", "department_head"].includes(user.role) && (
                        <>
                          {r.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(r.id, "approved")}
                                className="px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(r.id, "rejected")}
                                className="px-2.5 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === "approved" && (
                            <button
                              onClick={() => {
                                setSelectedReq(r);
                                setIsAssignOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                            >
                              <UserPlus className="h-3 w-3" />
                              Assign Tech
                            </button>
                          )}
                          {r.status === "assigned" && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, "in_progress")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors cursor-pointer"
                            >
                              <Play className="h-3 w-3" />
                              Start Work
                            </button>
                          )}
                          {["assigned", "in_progress"].includes(r.status) && (
                            <button
                              onClick={() => {
                                setSelectedReq(r);
                                setResolveCost(r.cost.toString());
                                setIsResolveOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="inline-flex items-center justify-center h-7 w-7 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-primary/20 bg-card p-3.5 shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-5">
            <span className="text-xs font-bold text-foreground">
              {selectedIds.length} items selected
            </span>
            <div className="h-4 w-px bg-border" />
            <div className="flex gap-1.5">
              <button
                onClick={() => handleBulkStatusUpdate("approved")}
                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold cursor-pointer"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("rejected")}
                className="px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold cursor-pointer"
              >
                Reject Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer hover:bg-red-700"
              >
                Delete Selected
              </button>
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Modal: Create Maintenance Request */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-foreground mb-4">Raise Maintenance Request</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">Select Equipment / Asset</label>
                  <select
                    value={newAssetId}
                    onChange={(e) => setNewAssetId(e.target.value)}
                    required
                    className="input mt-1 w-full text-sm"
                  >
                    <option value="">Choose an asset...</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.asset_tag}) — {a.status} / {a.condition}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">Issue Details</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe what is broken or needs service..."
                    required
                    rows={3}
                    className="input mt-1 w-full text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Priority Level</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="input mt-1 w-full text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground">Estimated Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      className="input mt-1 w-full text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    Attach Image / Invoice Evidence
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="mt-1 w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Technician */}
        {isAssignOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-foreground mb-4">Assign Service Technician</h2>
              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">Technician Name</label>
                  <input
                    type="text"
                    value={techName}
                    onChange={(e) => setTechName(e.target.value)}
                    placeholder="Enter technician or contractor name..."
                    required
                    className="input mt-1 w-full text-sm"
                  />
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignOpen(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Assign Technician
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Resolve Request */}
        {isResolveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-foreground mb-4">Mark Maintenance Resolved</h2>
              <form onSubmit={handleResolve} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground">Actual Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={resolveCost}
                    onChange={(e) => setResolveCost(e.target.value)}
                    required
                    className="input mt-1 w-full text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  Marking this resolved will automatically set the asset's condition back to normal and status to <strong>Available</strong>.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResolveOpen(false)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Confirm Resolution
                  </button>
                </div>
              </form>
            </div>
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

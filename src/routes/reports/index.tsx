import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getUser, type CurrentUser } from "@/lib/assetflow-api";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { 
  FileText, Download, Printer, Calendar, BarChart3, TrendingUp, 
  DollarSign, Wrench, ShieldAlert, PieChart as PieIcon, RefreshCw
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — AssetFlow" },
      { name: "description", content: "Advanced business intelligence and asset performance reports." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ReportsPage />
    </ProtectedRoute>
  ),
});

interface AnalyticsData {
  utilization_rate: number;
  total_assets: number;
  allocated_assets: number;
  maintenance_frequency: Array<{ name: string; tag: string; count: number }>;
  department_summary: Array<{ department: string; count: number; value: number }>;
  audit_stats: {
    cycle_id: number | null;
    completion_percentage: number;
    status: string;
    total_assets?: number;
    audited_assets?: number;
  };
  missing_assets_count: number;
  damaged_assets_count: number;
  total_maintenance_cost: number;
  monthly_maintenance_costs: Array<{ month: string; cost: number }>;
}

function ReportsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      
      const data = await api<AnalyticsData>(`/api/reports/dashboard?${params.toString()}`);
      setAnalytics(data);
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
      loadAnalytics();
    }
  }, [user, startDate, endDate]);

  const handleExport = (type: "assets" | "maintenance" | "audits") => {
    try {
      const url = `${window.location.protocol}//${window.location.hostname}:5000/api/reports/export?type=${type}&format=csv&token=${localStorage.getItem("assetflow_token") || ""}`;
      window.open(url, "_blank");
      toast.success(`Exporting ${type} CSV...`);
    } catch (e) {
      toast.error("Failed to export report");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!analytics) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
          <span>Loading analytics engine...</span>
        </div>
      </div>
    );
  }

  // Recharts colors
  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ec4899"];
  
  const utilizationPieData = [
    { name: "Allocated", value: analytics.allocated_assets },
    { name: "Available / Idle", value: analytics.total_assets - analytics.allocated_assets }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 print:p-0 print:max-w-full">
        
        {/* Header - hide on print if desired, or keep clean */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center print:hidden">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Reports & Advanced Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time utilization rates, audit summaries, and maintenance costs.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card hover:bg-accent px-4 py-2.5 text-sm font-semibold text-foreground cursor-pointer shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-[200px]">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </div>
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer"
            >
              Clear Filters
            </button>

            {/* Quick Exports */}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => handleExport("assets")}
                className="inline-flex items-center gap-1 text-xs font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Assets
              </button>
              <button
                onClick={() => handleExport("maintenance")}
                className="inline-flex items-center gap-1 text-xs font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Maintenance
              </button>
              <button
                onClick={() => handleExport("audits")}
                className="inline-flex items-center gap-1 text-xs font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-2 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Audits
              </button>
            </div>
          </div>
        </section>

        {/* Print-only Header */}
        <div className="hidden print:block mb-8 border-b border-border pb-4">
          <h1 className="text-3xl font-extrabold text-foreground">AssetFlow Analytics Summary Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generated on: {new Date().toLocaleString()} | Filter Range: {startDate || "Beginning"} to {endDate || "Present"}
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8 print:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Utilization Rate</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">
                {analytics.utilization_rate}%
              </span>
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              {analytics.allocated_assets} of {analytics.total_assets} active assets
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Maintenance Cost</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">
                ${analytics.total_maintenance_cost.toFixed(2)}
              </span>
              <DollarSign className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              Cumulated repair expenditures
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Audit Discrepancies</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-destructive">
                {analytics.missing_assets_count + analytics.damaged_assets_count}
              </span>
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              {analytics.missing_assets_count} lost / {analytics.damaged_assets_count} damaged
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Active Audit Cycles</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-bold text-foreground">
                {analytics.audit_stats.status === "open" ? "1" : "0"}
              </span>
              <FileText className="h-6 w-6 text-orange-500" />
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              {analytics.audit_stats.status === "open" ? `Completion: ${analytics.audit_stats.completion_percentage}%` : "No cycles active"}
            </span>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-8 print:grid-cols-2">
          
          {/* Monthly Maintenance Cost */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Maintenance Cost Trend (6 Months)
            </h3>
            <div className="h-72 w-full">
              {analytics.monthly_maintenance_costs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No historical cost data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.monthly_maintenance_costs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="cost" stroke="#6366f1" fillOpacity={1} fill="url(#colorCost)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Department Assets Summary */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              Asset Value by Department ($)
            </h3>
            <div className="h-72 w-full">
              {analytics.department_summary.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No allocations found</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.department_summary} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Asset Utilization Pie */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <PieIcon className="h-4 w-4 text-primary" />
              Utilization Rate Allocation
            </h3>
            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={utilizationPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {utilizationPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Maintenance Frequency (Top Assets) */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-primary" />
              Most Maintained Equipment
            </h3>
            <div className="h-72 w-full">
              {analytics.maintenance_frequency.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No maintenance records logged</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.maintenance_frequency} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 8 }} width={80} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

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

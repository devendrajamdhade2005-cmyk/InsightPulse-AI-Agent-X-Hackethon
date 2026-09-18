import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Beaker,
  BookOpen,
  Bookmark,
  Boxes,
  Brain,
  Building2,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  Filter,
  Flag,
  Gauge,
  GitBranch,
  Globe,
  Grid2x2,
  Handshake,
  Info,
  Layers,
  LayoutDashboard,
  Link2,
  ListChecks,
  Loader,
  LogOut,
  Map,
  Menu,
  Microscope,
  Minus,
  Moon,
  Network,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Scale,
  Scroll,
  Search,
  Settings,
  Shield,
  Sparkles,
  Square,
  Star,
  Sun,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

/* Single icon vocabulary for the whole app.
 *
 * Everything is a stroked vector from one family, so weight and corner treatment
 * stay consistent. The previous build leaned on emoji, which rendered differently
 * on every OS, could not inherit colour or stroke weight, and read as decoration
 * rather than interface.
 *
 * Domain concepts are mapped here rather than at each call site, so a label and its
 * icon can never drift apart — and backend payloads that still carry an emoji are
 * simply ignored in favour of the mapping below.
 */

export {
  Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUpRight, Ban, Beaker,
  BookOpen, Bookmark, Boxes, Brain, Building2, ChartColumn, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, CircleDot, Clock, Cpu, Database,
  DollarSign,
  Download, Ellipsis, ExternalLink, Eye, FileDown, FileText, Filter, Flag, Gauge,
  GitBranch, Globe, Grid2x2, Handshake, Info, Layers, LayoutDashboard, Link2,
  ListChecks, Loader, LogOut, Map, Menu, Microscope, Minus, Moon, Network,
  Newspaper, Play, Plus, RefreshCw, Rocket, Scale, Scroll, Search, Settings,
  Shield, Sparkles, Square, Star, Sun, Target, Trash2, TrendingDown, TrendingUp,
  Trophy, User, Users, Wrench, X, Zap,
};

/* ── dashboard sections ──────────────────────────────────── */
export const VIEW_ICONS = {
  overview: LayoutDashboard,
  research: Microscope,
  competitors: Building2,
  patents: Scroll,
  news: Newspaper,
  insights: Target,
  framework: GitBranch,
  evaluation: ChartColumn,
  observability: Activity,
  reports: FileDown,
};

/* ── finding categories (format.js CATEGORY keys) ────────── */
export const CATEGORY_ICONS = {
  research: Beaker,
  patent: Scroll,
  competitor: Building2,
  news: Newspaper,
  web: Globe,
};

/* ── agents ──────────────────────────────────────────────── */
export const AGENT_ICONS = {
  orchestrator: Brain,
  research_agent: Microscope,
  competitive_agent: Building2,
};

/* ── collaboration event kinds ───────────────────────────── */
export const COLLAB_ICONS = {
  follow_up: ArrowUpRight,
  corroboration: Check,
  handoff: Link2,
  merge: Boxes,
  gap_fill: Map,
};

/* ── observability span kinds ────────────────────────────── */
export const SPAN_ICONS = {
  run: Play,
  orchestrator: Brain,
  node: Square,
  agent: Cpu,
  decision: Scale,
  llm: Brain,
  tool: Wrench,
  provider: Globe,
  retry: RefreshCw,
  fallback: ArrowDown,
  memory: Database,
  evaluation: ChartColumn,
  verification: Shield,
  synthesis: Sparkles,
};

/* ── LangGraph framework events ──────────────────────────── */
export const FW_EVENT_ICONS = {
  planner_started: Target,
  plan_created: ListChecks,
  task_decomposed: Boxes,
  parallel_tasks_started: Zap,
  agent_started: Cpu,
  tool_started: Wrench,
  tool_succeeded: Check,
  tool_failed: AlertTriangle,
  tool_timeout: Clock,
  retry_started: RefreshCw,
  fallback_started: ArrowDown,
  fallback_succeeded: Check,
  evaluation_started: Gauge,
  evaluation_completed: Gauge,
  conflict_detected: AlertTriangle,
  conflict_resolved: Check,
  verification_started: Search,
  verification_completed: Shield,
  replan_triggered: RefreshCw,
  checkpoint_saved: Database,
  budget_constraint_detected: DollarSign,
  deadlock_detected: Ban,
  resource_status: Gauge,
  final_synthesis_started: Sparkles,
  run_completed: Check,
  memory_updated: Brain,
};

/**
 * Activity-log phase → icon.
 *
 * The backend sends an emoji in `entry.icon`. That field is deliberately ignored:
 * mapping from the structured `phase` instead keeps the UI vector-only without
 * requiring any backend change.
 */
export const PHASE_ICONS = {
  start: Play,
  goal: Target,
  plan: ListChecks,
  decision: Scale,
  action: Search,
  observation: Eye,
  thought: Brain,
  warning: AlertTriangle,
  error: CircleAlert,
  final: Flag,
  insight: Sparkles,
  done: Check,
};

/* ── the six-step live tracker ───────────────────────────── */
export const STEP_ICONS = {
  goal: Target,
  plan: ListChecks,
  search: Search,
  analyze: Brain,
  trends: TrendingUp,
  report: FileText,
};

/* ── resolvers (never return undefined) ──────────────────── */
export const viewIcon = (key) => VIEW_ICONS[key] || LayoutDashboard;
export const categoryIconFor = (key) => CATEGORY_ICONS[key] || CircleDot;
export const agentIcon = (key) => AGENT_ICONS[key] || Cpu;
export const collabIcon = (key) => COLLAB_ICONS[key] || CircleDot;
export const spanIcon = (kind) => SPAN_ICONS[kind] || Square;
export const fwEventIcon = (key) => FW_EVENT_ICONS[key] || CircleDot;
export const phaseIcon = (phase) => PHASE_ICONS[phase] || CircleDot;
export const stepIcon = (key) => STEP_ICONS[key] || CircleDot;

/**
 * Priority / relevance marker.
 *
 * Replaces the coloured emoji dots. Colour comes from the surrounding tone class,
 * and the shape is filled, so the marker still reads in greyscale — the original
 * rule that colour is never the only signal is preserved.
 */
export function ToneDot({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`nb-a-solid inline-block h-2.5 w-2.5 shrink-0 border-2 border-line ${className}`}
    />
  );
}

/** Growth direction marker used by the topics list. */
export const trendIcon = (value, isNew) => {
  if (isNew) return Sparkles;
  if (value === null || value === undefined) return Minus;
  if (value > 0) return TrendingUp;
  if (value < 0) return TrendingDown;
  return Minus;
};

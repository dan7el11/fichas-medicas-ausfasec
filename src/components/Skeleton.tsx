// Bloque animado base
function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-200 rounded animate-pulse ${className}`}
    />
  );
}

// ─── Skeleton del Dashboard (sidebar + panel principal) ───────────────────────
export function DashboardSkeleton() {
  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: '#f5f7fa' }}>
      {/* TopBar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0">
        <Bone className="h-7 w-36" />
        <div className="flex-1" />
        <Bone className="h-7 w-28" />
        <Bone className="h-8 w-8 rounded-full" />
      </div>

      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '360px 1fr' }}>
        {/* Sidebar */}
        <div className="bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Buscador */}
          <div className="px-4 py-4 border-b border-slate-100">
            <Bone className="h-9 w-full rounded-lg" />
          </div>
          {/* Filtros */}
          <div className="px-4 py-3 flex gap-2 border-b border-slate-100">
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-6 w-16 rounded-full" />
          </div>
          {/* Lista */}
          <div className="flex-1 overflow-hidden px-3 pt-3 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <Bone className="w-10 h-10 rounded-[10px] flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Bone className="h-3.5 w-3/4" />
                  <Bone className="h-2.5 w-1/2" />
                </div>
                <Bone className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Panel principal */}
        <div className="overflow-y-auto px-7 pt-5 pb-8 flex flex-col gap-4">
          {/* Hero card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <Bone className="h-3 w-40 mb-4" />
            <div className="flex items-start gap-4">
              <Bone className="w-[60px] h-[60px] rounded-[14px] flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Bone className="h-6 w-56" />
                <Bone className="h-3 w-40" />
              </div>
              <div className="flex gap-2">
                <Bone className="h-8 w-32 rounded-lg" />
                <Bone className="h-8 w-36 rounded-lg" />
              </div>
            </div>
            <Bone className="h-16 w-full rounded-[10px] mt-4" />
          </div>

          {/* Vitales card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
            <Bone className="h-4 w-48" />
            <div className="grid grid-cols-2 gap-4">
              <Bone className="h-24 rounded-xl" />
              <Bone className="h-24 rounded-xl" />
            </div>
          </div>

          {/* Diagnósticos card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <Bone className="h-4 w-44" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex gap-3 border-b border-slate-100 last:border-0">
                <Bone className="h-3 w-12 rounded" />
                <Bone className="h-3 flex-1" />
                <Bone className="h-4 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton de DetalleTrabajador ────────────────────────────────────────────
export function DetalleSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center gap-4">
        <Bone className="h-8 w-20 rounded-lg" />
        <div className="flex-1 flex flex-col gap-2">
          <Bone className="h-5 w-56" />
          <Bone className="h-3 w-32" />
        </div>
        <Bone className="h-9 w-28 rounded-lg" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 flex flex-col gap-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-9 w-32 rounded-lg" />
          ))}
        </div>

        {/* Card grande */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
          <Bone className="h-4 w-48" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Bone className="h-2.5 w-20" />
                <Bone className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Evaluaciones list */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <Bone className="h-4 w-40" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4 border-b border-slate-100 last:border-0">
              <Bone className="h-4 w-20" />
              <Bone className="h-4 flex-1" />
              <Bone className="h-6 w-16 rounded-full" />
              <Bone className="h-7 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

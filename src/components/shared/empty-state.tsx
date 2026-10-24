export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
      {icon && <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

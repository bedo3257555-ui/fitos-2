"use client";
import * as React from "react";
import { ImageOff } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PhotoImg({ path, alt, className, draggable = false }: { path: string; alt: string; className?: string; draggable?: boolean }) {
  const { photoUrl } = useData();
  const [url, setUrl] = React.useState<string | null>(null);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    setUrl(null); setErr(false);
    photoUrl(path).then((u) => live && setUrl(u)).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [path, photoUrl]);
  if (err) return <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}><ImageOff className="size-6" /></div>;
  if (!url) return <Skeleton className={cn("rounded-none", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} draggable={draggable} className={cn("object-cover", className)} />;
}

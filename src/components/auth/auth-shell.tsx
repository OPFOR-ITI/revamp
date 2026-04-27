import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  embedded = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  embedded?: boolean;
}) {
  const content = (
    <div className="w-full max-w-md">
      <Card className="border-emerald-900/10 bg-white/85 shadow-2xl shadow-emerald-950/8 backdrop-blur">
        <CardHeader className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-800/70">
            {eyebrow}
          </p>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight text-zinc-950">
              {title}
            </CardTitle>
            <p className="text-sm leading-6 text-zinc-600">{description}</p>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );

  if (embedded) {
    return <div className="flex justify-center py-8">{content}</div>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(70,104,61,0.18),_transparent_48%),linear-gradient(180deg,_#f3f0e4_0%,_#ebe4d0_48%,_#dde2d2_100%)] px-4 py-10">
      {content}
    </main>
  );
}

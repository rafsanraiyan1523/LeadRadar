import { Logo } from "@lead-radar/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
      <Logo size={28} wordmarkClassName="text-xl font-semibold tracking-tight" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

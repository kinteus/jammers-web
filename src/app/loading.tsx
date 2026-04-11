import { Loader } from "@/components/ui/loader";

export default function GlobalLoading() {
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
      <div className="brand-shell flex min-w-[260px] flex-col items-center gap-3 px-8 py-7 text-center">
        <Loader label="Loading page..." />
        <p className="text-sm text-white/60">Preparing the next screen.</p>
      </div>
    </div>
  );
}

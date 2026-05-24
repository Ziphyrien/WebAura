export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 md:px-8 py-16 md:py-24 select-none">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center animate-in fade-in duration-1000 slide-in-from-bottom-3">
        {/* Brand Tag - Small, high-contrast, modern */}
        <span className="text-[10px] tracking-[0.2em] font-bold text-foreground/40 uppercase font-sans">
          WebAura
        </span>

        {/* Tagore Slogan */}
        <div className="space-y-4 max-w-xl mx-auto">
          {/* English - Highly modern, clean sans-serif with a spacious leading */}
          <p className="font-sans text-xl sm:text-2xl md:text-3xl font-light tracking-tight text-foreground/90 leading-relaxed [text-wrap:balance]">
            &ldquo;My thoughts, like spark-riding fireflies, shimmer in the deep silence of your own
            starry sky.&rdquo;
          </p>

          {/* Chinese - Balanced, readable sans-serif */}
          <p className="font-sans text-xs sm:text-sm font-light tracking-wide text-muted-foreground/70 leading-relaxed [text-wrap:balance]">
            思想如点点萤火，在属于你自己的寂静星空中闪烁。
          </p>
        </div>
      </div>
    </div>
  );
}

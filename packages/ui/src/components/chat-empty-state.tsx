export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 md:px-8 py-16 md:py-24 select-none">
      <div className="flex w-full max-w-4xl flex-col items-center gap-7 sm:gap-8 text-center mt-[-10vh]">
        {/* Tagore Slogan */}
        <div className="space-y-6 w-full max-w-2xl mx-auto flex flex-col items-center">
          {/* English - Beautifully elegant, airy EB Garamond italic */}
          <div className="relative inline-flex text-left">
            <span className="absolute -left-10 sm:-left-14 -top-3 sm:-top-4 text-6xl sm:text-8xl text-primary/20 dark:text-primary/30 font-serif leading-none select-none">
              &ldquo;
            </span>
            <p className="font-poetic italic text-2xl sm:text-3xl lg:text-4xl text-foreground/85 leading-[1.6] tracking-wide font-light mix-blend-normal">
              <span className="block whitespace-nowrap">
                My thoughts, like spark-riding fireflies
              </span>
              <span className="block whitespace-nowrap">
                shimmer in the deep silence of your own
              </span>
              <span className="block whitespace-nowrap">starry sky</span>
            </p>
          </div>

          {/* Chinese - Refined, elegant serif for literary feel, wide tracking */}
          <p className="font-sans text-xs sm:text-sm tracking-[0.25em] text-muted-foreground/70 leading-relaxed font-normal ml-2">
            思想如点点萤火，在属于你自己的寂静星空中闪烁
          </p>
        </div>
      </div>
    </div>
  );
}

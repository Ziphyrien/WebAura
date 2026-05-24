export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 md:px-8 py-16 md:py-24 select-none">
      <div className="flex w-full max-w-4xl flex-col items-center gap-7 sm:gap-8 text-center animate-in fade-in duration-1000 slide-in-from-bottom-2 mt-[-10vh]">
        {/* Tagore Slogan */}
        <div className="space-y-6 w-full mx-auto">
          {/* English - Beautifully elegant, airy EB Garamond italic, allowed to stretch wide */}
          <p className="font-poetic italic text-2xl sm:text-3xl lg:text-4xl text-foreground/85 leading-relaxed tracking-wide font-light">
            &ldquo;My thoughts, like spark-riding fireflies, shimmer in the deep silence of your own
            starry sky.&rdquo;
          </p>

          {/* Chinese - Refined, elegant serif for literary feel, wide tracking */}
          <p className="font-sans text-sm tracking-[0.2em] text-foreground/50 leading-relaxed font-normal">
            思想如点点萤火，在属于你自己的寂静星空中闪烁。
          </p>
        </div>
      </div>
    </div>
  );
}

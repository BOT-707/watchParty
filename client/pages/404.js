import Link from 'next/link';

export default function Custom404() {
  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="font-display font-black text-[8rem] leading-none text-amber-400/20 select-none">
          404
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-text-primary mb-2">Room Not Found</h1>
          <p className="text-text-secondary text-sm">The room you're looking for doesn't exist or has expired.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl btn-amber text-sm font-display font-semibold"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Back Home
        </Link>
      </div>
    </div>
  );
}

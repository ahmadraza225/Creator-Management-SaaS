"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg p-10">
      <div className="card p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          The last action could not be saved. Check the form values (numbers, links, dates) and try again.
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs text-slate-600">
          {error.digest ? `Reference: ${error.digest}` : error.message}
        </pre>
        <button className="btn mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}

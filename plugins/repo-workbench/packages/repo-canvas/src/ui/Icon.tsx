/** Familiar actions share one quiet, scalable stroke style. Names live on their controls. */
export function Icon({ name }: { name: 'info' | 'copy' | 'refresh' | 'download' | 'check' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'info' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      )}
      {name === 'copy' && (
        <>
          <rect x="8" y="8" width="12" height="13" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
        </>
      )}
      {name === 'refresh' && (
        <>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" />
        </>
      )}
      {name === 'download' && (
        <>
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
        </>
      )}
      {name === 'check' && <path d="m5 12 4 4L19 6" />}
    </svg>
  );
}

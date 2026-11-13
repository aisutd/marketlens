import { useEffect, useId, useRef, useState } from "react";
import { Info, X } from "lucide-react";

// A floating "i" button that opens a modal explanation.
//
// Built on the native <dialog> with showModal(), which gives what the three
// hand-rolled copies on the result pages lacked: focus moves into the dialog
// on open, Escape closes it, the page behind is inert to keyboard, pointer and
// screen readers, and focus goes back to the trigger on close.
export default function InfoDialog({
  triggerLabel,
  title,
  children,
  closeButtonClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Fires for every way the dialog closes, Escape included.
  function handleClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // The dialog box has no padding of its own, so a click whose target is
  // the <dialog> itself landed on the backdrop.
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        className="fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center border border-ink bg-primary text-primary-foreground shadow-offset focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <Info size={21} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={handleClose}
        onClick={handleBackdropClick}
        className="mb-4 ml-auto mr-4 mt-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border border-ink bg-card p-0 text-foreground shadow-offset backdrop:bg-foreground/45 sm:mb-6 sm:mr-6"
      >
        {open && (
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2
                id={titleId}
                className="font-display text-3xl"
              >
                {title}
              </h2>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {children}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`mt-7 w-full ${closeButtonClassName}`}
            >
              Got it
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}

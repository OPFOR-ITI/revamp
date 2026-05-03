function fallbackCopyTextToClipboard(value: string) {
  if (typeof document === "undefined") {
    throw new Error("Clipboard access is unavailable in this context.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    const copied = document.execCommand("copy");

    if (!copied) {
      throw new Error("The browser blocked automatic clipboard access.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyTextToClipboard(value: string) {
  if (typeof navigator === "undefined") {
    throw new Error("Clipboard access is unavailable in this context.");
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      fallbackCopyTextToClipboard(value);
      return;
    }
  }

  fallbackCopyTextToClipboard(value);
}

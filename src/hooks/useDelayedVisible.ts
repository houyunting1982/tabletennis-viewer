import { useEffect, useState } from "react";

export function useDelayedVisible(visible: boolean, delayMs = 250) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }

    const timer = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [visible, delayMs]);

  return show;
}

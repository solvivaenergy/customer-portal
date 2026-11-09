import { useEffect, useState } from "react";

/** Below Tailwind's `sm`: a phone, where the charts use their compact axes and the period picker sits under the range filter. */
export const PHONE_QUERY = "(max-width: 639.98px)";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

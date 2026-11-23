export function navigate(path: string, replace = true) {
  if (window.location.pathname + window.location.search !== path) {
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
export function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

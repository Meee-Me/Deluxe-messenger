export const P = {
  updates: "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm0 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  calls: "M5 4h4l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z",
  chats: "M4 5.5h16v10.5H9.5L5 19.5V16H4z",
  keys: "M8 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12h9M18 12v3M15 12v2",
  you: "M12 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM5 20c0-4 3-6 7-6s7 2 7 6",
  video: "M4.5 6h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6zM16 10l5-3v10l-5-3",
  clip: "M20 11l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8",
  plus: "M12 5v14M5 12h14",
  userPlus: "M9 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20c0-3.6 2.7-5.5 6.5-5.5s6.5 1.9 6.5 5.5M19 8v6M16 11h6",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12.5l4.5 4.5L19 7.5",
  reply: "M10 7L4 12l6 5M4 12h10a6 6 0 0 1 6 6",
  info: "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 11v5M12 8h.01",
  back: "M15 5l-7 7 7 7",
  x: "M6 6l12 12M18 6L6 18",
  // a scalloped wax seal with a dot in the middle
  seal: "M12 3l2.2 1.6 2.7-.2 1 2.5 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-1 2.5-2.7-.2L12 21l-2.2-1.6-2.7.2-1-2.5-2.2-1.6.9-2.6-.9-2.6 2.2-1.6 1-2.5 2.7.2zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  ghost: "M6 20V11a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM10 11h.01M14 11h.01",
  lock: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4",
  shieldAlert: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM12 8v5M12 16h.01",
};
export const NAV = [["Updates", P.updates], ["Calls", P.calls], ["Chats", P.chats], ["Keys", P.keys], ["You", P.you]] as const;
export const Icon = ({ d }: { d: string }) => <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

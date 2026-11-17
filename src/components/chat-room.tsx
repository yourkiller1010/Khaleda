"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CornerUpLeft, Edit3, MoreHorizontal, Pin, Search, Send, Smile, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Message = { id: string; body: string; status: string; createdAt: string; userId: string; user: { id: string; username: string; displayName: string; avatarUrl: string | null; role: { name: string; key: string } }; reactions: Array<{ userId: string; emoji: string }>; replyTo?: { id: string; body: string; user: { displayName: string } } | null };
type Presence = { id: string; username: string; displayName: string; avatarUrl: string | null; role: string };
const emojis = ["👍", "🤍", "🔥", "👏", "💡", "✅"];

export function ChatRoom({ locale, roomSlug, initialMessages, initialPinned, currentUserId, canModerate, slowModeSeconds }: { locale: string; roomSlug: string; initialMessages: Message[]; initialPinned: string[]; currentUserId: string; canModerate: boolean; slowModeSeconds: number }) {
  const t = useTranslations("chat");
  const [messages, setMessages] = useState(initialMessages);
  const [members, setMembers] = useState<Presence[]>([]);
  const [pinned, setPinned] = useState(new Set(initialPinned));
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = useCallback((payload: object) => { if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(payload)); }, []);
  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${location.host}/api/ws?room=${encodeURIComponent(roomSlug)}`);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "presence") setMembers(data.users);
      if (data.type === "message") {
        setMessages((current) => [...current, { ...data.message, createdAt: new Date(data.message.createdAt).toISOString() }]);
        if (document.hidden && data.message.userId !== currentUserId) setUnread((value) => value + 1);
      }
      if (data.type === "update") setMessages((current) => current.map((message) => message.id === data.message.id ? { ...data.message, createdAt: new Date(data.message.createdAt).toISOString() } : message));
      if (data.type === "delete") setMessages((current) => current.map((message) => message.id === data.id ? { ...message, status: "DELETED", body: "" } : message));
      if (data.type === "reaction") setMessages((current) => current.map((message) => {
        if (message.id !== data.messageId) return message;
        const reactions = data.removed ? message.reactions.filter((item) => !(item.userId === data.userId && item.emoji === data.emoji)) : [...message.reactions, { userId: data.userId, emoji: data.emoji }];
        return { ...message, reactions };
      }));
      if (data.type === "pin") setPinned((current) => { const next = new Set(current); if (data.pinned) next.add(data.messageId); else next.delete(data.messageId); return next; });
      if (data.type === "typing") { setTyping(data.displayName); if (typingTimer.current) clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setTyping(null), 2200); }
      if (data.type === "error") toast.error(t(data.code === "SLOW_MODE" ? "slowMode" : "disconnected", { seconds: slowModeSeconds }));
    };
    return () => { socket.close(); socketRef.current = null; };
  }, [roomSlug, currentUserId, t, slowModeSeconds]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);
  useEffect(() => { const visible = () => { if (!document.hidden) setUnread(0); }; document.addEventListener("visibilitychange", visible); return () => document.removeEventListener("visibilitychange", visible); }, []);
  const filtered = messages.filter((message) => message.body.toLowerCase().includes(query.toLowerCase()) || message.user.displayName.toLowerCase().includes(query.toLowerCase()));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || !connected) return;
    if (editing) send({ type: "edit", id: editing.id, body });
    else send({ type: "message", body, replyToId: reply?.id });
    setBody(""); setReply(null); setEditing(null);
  }
  return <div className="grid min-h-[calc(100dvh-190px)] gap-5 xl:grid-cols-[1fr_280px]"><section className="surface flex min-h-[620px] flex-col overflow-hidden"><div className="flex flex-wrap items-center gap-3 border-b border-border p-4"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 text-muted" size={15} /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} /></div><button className={`btn ${showPinned ? "btn-primary" : "btn-secondary"}`} type="button" onClick={() => setShowPinned(!showPinned)}><Pin size={14} />{t("pinned")} {pinned.size || ""}</button><span className="badge"><span className="status-dot" />{members.length} {t("online")}</span>{unread > 0 && <span className="badge">{unread} new</span>}</div>
      {showPinned && <div className="border-b border-border bg-elevated p-4"><p className="micro text-muted mb-3">{t("pinned")}</p>{messages.filter((message) => pinned.has(message.id)).map((message) => <button type="button" key={message.id} className="block w-full border-t border-border py-3 text-left text-sm" onClick={() => { setShowPinned(false); setQuery(message.body.slice(0, 24)); }}>{message.user.displayName}: <span className="text-muted">{message.body}</span></button>)}{!pinned.size && <p className="text-sm text-muted">{t("empty")}</p>}</div>}
      <div className="scrollbar flex-1 space-y-5 overflow-y-auto p-4 md:p-6">{filtered.map((message) => <motion.article layout="position" key={message.id} className="group relative"><div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-elevated text-xs">{message.user.avatarUrl ? <Image src={message.user.avatarUrl} alt="" width={36} height={36} unoptimized className="h-full w-full rounded-full object-cover" /> : message.user.displayName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{message.user.displayName}</span><span className="badge !text-[8px]">{message.user.role.name}</span><time className="text-[10px] text-muted">{new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time>{message.status === "EDITED" && <span className="text-[10px] text-muted">{t("edited")}</span>}{pinned.has(message.id) && <Pin size={11} className="text-muted" />}</div>{message.replyTo && <div className="mt-2 border-l border-border pl-3 text-xs text-muted">{message.replyTo.user.displayName}: {message.replyTo.body.slice(0, 100)}</div>}<p className={`mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed ${message.status === "DELETED" ? "italic text-muted" : ""}`}>{message.status === "DELETED" ? t("deleted") : message.body}</p>{message.status !== "DELETED" && <div className="mt-2 flex flex-wrap items-center gap-1">{[...new Set(message.reactions.map((item) => item.emoji))].map((emoji) => { const list = message.reactions.filter((item) => item.emoji === emoji); return <button type="button" key={emoji} onClick={() => send({ type: "reaction", id: message.id, emoji })} className={`badge ${list.some((item) => item.userId === currentUserId) ? "!border-muted !text-foreground" : ""}`}>{emoji} {list.length}</button>; })}<div className="relative"><button type="button" className="icon-btn !h-7 !w-7 opacity-70 hover:opacity-100" onClick={() => setEmojiFor(emojiFor === message.id ? null : message.id)} aria-label={t("react")}><Smile size={13} /></button>{emojiFor === message.id && <div className="absolute bottom-8 left-0 z-20 flex rounded-full border border-border bg-background p-1 shadow-xl">{emojis.map((emoji) => <button type="button" className="grid h-8 w-8 place-items-center rounded-full hover:bg-elevated" key={emoji} onClick={() => { send({ type: "reaction", id: message.id, emoji }); setEmojiFor(null); }}>{emoji}</button>)}</div>}</div><button type="button" className="icon-btn !h-7 !w-7 opacity-70" onClick={() => setReply(message)} aria-label={t("reply")}><CornerUpLeft size={13} /></button><button type="button" className="icon-btn !h-7 !w-7 opacity-70" onClick={() => setMenu(menu === message.id ? null : message.id)} aria-label={t("details")}><MoreHorizontal size={13} /></button></div>}</div></div>{menu === message.id && <div className="absolute right-0 top-8 z-20 grid w-40 rounded-xl border border-border bg-background p-1 shadow-xl">{(message.userId === currentUserId) && message.status !== "DELETED" && <button type="button" className="nav-link !min-h-9 text-xs" onClick={() => { setEditing(message); setBody(message.body); setMenu(null); }}><Edit3 size={13} />Edit</button>}{canModerate && <button type="button" className="nav-link !min-h-9 text-xs" onClick={() => { send({ type: "pin", id: message.id }); setMenu(null); }}><Pin size={13} />{pinned.has(message.id) ? "Unpin" : "Pin"}</button>}{(message.userId === currentUserId || canModerate) && message.status !== "DELETED" && <button type="button" className="nav-link !min-h-9 text-xs" onClick={() => { if (confirm("Delete this message?")) send({ type: "delete", id: message.id }); setMenu(null); }}><Trash2 size={13} />Delete</button>}</div>}</motion.article>)}{!filtered.length && <div className="grid h-full min-h-64 place-items-center text-center"><p className="max-w-sm text-sm text-muted">{t("empty")}</p></div>}<div ref={endRef} /></div>
      <div className="border-t border-border p-4"><div className="min-h-5 text-xs text-muted">{typing ? t("typing", { name: typing }) : !connected ? t("disconnected") : slowModeSeconds > 0 ? t("slowMode", { seconds: slowModeSeconds }) : ""}</div>{(reply || editing) && <div className="mb-3 flex items-center justify-between rounded-lg bg-elevated px-3 py-2 text-xs"><span className="truncate">{editing ? `Editing: ${editing.body}` : `${t("reply")}: ${reply?.body}`}</span><button type="button" className="icon-btn !h-7 !w-7" onClick={() => { setReply(null); setEditing(null); setBody(""); }}><X size={13} /></button></div>}<form onSubmit={submit} className="flex items-end gap-2"><textarea className="textarea !min-h-12 flex-1 resize-none" rows={1} maxLength={3000} value={body} onChange={(event) => { setBody(event.target.value); send({ type: "typing" }); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(event); } }} placeholder={t("placeholder")} aria-label={t("placeholder")} /><button type="submit" className="icon-btn bg-foreground text-background" disabled={!connected || !body.trim()} aria-label={t("send")}><Send size={17} /></button></form></div>
    </section><aside className="surface h-fit p-5"><div className="flex items-center justify-between"><h2 className="font-medium">{t("members")}</h2><span className="badge">{members.length}</span></div><p className="micro text-muted mt-2">{t("online")}</p><div className="mt-5 grid gap-3"><AnimatePresence>{members.map((member) => <motion.div key={member.id} className="flex items-center gap-3 border-t border-border pt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-elevated text-xs">{member.displayName.slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-sm">{member.displayName}</p><p className="truncate text-[10px] text-muted">@{member.username} · {member.role}</p></div><span className="status-dot ml-auto" /></motion.div>)}</AnimatePresence>{!members.length && <p className="text-sm text-muted">{t("connecting")}</p>}</div></aside></div>;
}

import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageIntro } from "@/components/motion";
import { ChatRoom } from "@/components/chat-room";

export default async function ChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations();
  const room = await db.chatRoom.findUnique({ where: { slug: "global" }, include: { messages: { include: { user: { include: { role: true } }, reactions: true, replyTo: { include: { user: { select: { displayName: true } } } } }, orderBy: { createdAt: "desc" }, take: 80 }, pins: true } });
  if (!room) return <p>{t("common.noData")}</p>;
  const messages = room.messages.reverse().map((message) => ({ ...message, createdAt: message.createdAt.toISOString(), updatedAt: message.updatedAt.toISOString(), deletedAt: message.deletedAt?.toISOString() ?? null, replyTo: message.replyTo ? { id: message.replyTo.id, body: message.replyTo.body, user: { displayName: message.replyTo.user.displayName } } : null, reactions: message.reactions.map((reaction) => ({ userId: reaction.userId, emoji: reaction.emoji })) }));
  return <div><PageIntro eyebrow="COMMUNITY / AUTHENTICATED REAL-TIME" title={t("chat.title")} subtitle={t("chat.subtitle")} /><div className="mt-7"><ChatRoom locale={locale} roomSlug={room.slug} initialMessages={messages} initialPinned={room.pins.map((pin) => pin.messageId)} currentUserId={user.id} canModerate={["OWNER", "ADMIN", "MODERATOR"].includes(user.role.key)} slowModeSeconds={room.slowModeSeconds} /></div></div>;
}

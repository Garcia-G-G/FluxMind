import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { PresenceUser } from "@/lib/collaboration";

const MAX_VISIBLE = 5;

export const PresenceAvatars = ({
  users,
}: {
  users: PresenceUser[];
}): React.ReactNode => {
  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <div
          key={user.id}
          className="relative"
          title={`${user.name}${user.view ? ` — ${user.view}` : ""}`}
        >
          <Avatar
            className="h-7 w-7 border-2 border-background"
            style={{ borderColor: user.color }}
          >
            <AvatarFallback
              className="text-[10px] text-white font-medium"
              style={{ backgroundColor: user.color }}
            >
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span
            className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background"
            style={{ backgroundColor: "#22c55e" }}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
          <span className="text-[10px] font-medium text-muted-foreground">
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
};

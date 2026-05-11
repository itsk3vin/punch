import { useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function SettingsProfileRoute() {
  const { user } = useAuth0();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="max-w-[600px] w-[600px] mx-auto">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight">Profile</h1>

        <div className="rounded-xl border bg-card text-sm">
          {/* Profile picture */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium">Profile picture</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Recommended size is 256×256px
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg overflow-hidden ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="size-10 rounded-lg">
                <AvatarImage
                  src={user?.picture ?? undefined}
                  alt={user?.name ?? "User"}
                />
                <AvatarFallback className="rounded-lg text-sm font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
            />
          </div>

          <Separator />

          {/* Full name */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-medium">Full name</p>
            <Input
              className="w-[280px]"
              defaultValue={user?.name ?? ""}
              placeholder="Your name"
            />
          </div>

          <Separator />

          {/* Email */}
          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-medium">Email</p>
            <Input
              className="w-[280px]"
              type="email"
              defaultValue={user?.email ?? ""}
              disabled
            />
          </div>
        </div>
      </div>
    </section>
  );
}

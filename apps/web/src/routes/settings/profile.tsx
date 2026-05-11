import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useEmployee } from "@/hooks/use-employee";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type ProfileFormValues = {
  name: string;
};

function getInitials(name: string | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstInitial = parts[0]?.charAt(0) ?? "";
  const lastInitial = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : "";
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();

  return initials || "?";
}

export function SettingsProfileRoute() {
  const { getAccessTokenSilently, user } = useAuth0();
  const { employee } = useEmployee();
  const [isSaved, setIsSaved] = useState(false);
  const {
    handleSubmit,
    register,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    values: {
      name: employee?.name ?? "",
    },
  });
  const name = watch("name");

  async function onSubmit(values: ProfileFormValues) {
    setIsSaved(false);
    const accessToken = await getAccessTokenSilently();
    const response = await fetch(`${apiBaseUrl}/api/v1/me/profile`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: values.name,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError("root", {
        message: body?.error ?? "Could not update your profile.",
      });
      return;
    }

    setIsSaved(true);
  }

  return (
    <section className="max-w-[600px] w-[600px] mx-auto">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight">Profile</h1>

        <form
          className="rounded-xl border bg-card text-sm"
          onSubmit={handleSubmit(onSubmit)}
        >
          {/* Profile picture */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium">Profile picture</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Generated from your first and last name.
              </p>
            </div>
            <Avatar className="size-10 rounded-lg">
              <AvatarFallback className="rounded-lg text-sm font-medium">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <Separator />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-medium">Full name</p>
            <div className="w-[280px]">
              <Input
                placeholder="Your name"
                {...register("name", {
                  required: "Name is required",
                  validate: (value) =>
                    value.trim().length > 0 || "Name is required",
                })}
              />
              {errors.name && (
                <p className="mt-2 text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
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

          <Separator />

          <div className="flex items-center justify-between px-5 py-4">
            <div>
              {errors.root && (
                <p className="text-xs text-destructive">{errors.root.message}</p>
              )}
              {isSaved && !errors.root && (
                <p className="text-xs text-muted-foreground">Profile updated.</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

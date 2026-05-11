import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { LogoUploadDialog } from "@/components/logo-upload-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useEmployee } from "@/hooks/use-employee";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type CompanyProfileFormValues = {
  name: string;
  slug: string;
};

type LogoUpload = {
  key: string;
  uploadUrl: string;
  contentType: string;
};

type OrganizationResponse = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function SettingsCompanyProfileRoute() {
  const { getAccessTokenSilently } = useAuth0();
  const { employee, organization } = useEmployee();
  const navigate = useNavigate();
  const [logo, setLogo] = useState<{ blob: Blob; previewUrl: string } | null>(
    null,
  );
  const isAdmin = employee?.role === "admin";
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<CompanyProfileFormValues>({
    values: {
      name: organization?.name ?? "",
      slug: organization?.slug ?? "",
    },
  });

  useEffect(() => {
    return () => {
      if (logo?.previewUrl) {
        URL.revokeObjectURL(logo.previewUrl);
      }
    };
  }, [logo?.previewUrl]);

  function handleLogoConfirm(nextLogo: { blob: Blob; previewUrl: string }) {
    if (logo?.previewUrl) {
      URL.revokeObjectURL(logo.previewUrl);
    }
    setLogo(nextLogo);
  }

  async function uploadLogo(
    accessToken: string,
    organizationId: string,
    nextLogo: { blob: Blob },
  ) {
    const uploadResponse = await fetch(
      `${apiBaseUrl}/api/v1/organization/${organizationId}/logo/upload-url`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!uploadResponse.ok) {
      const body = await uploadResponse.json().catch(() => null);
      throw new Error(body?.error ?? "Could not prepare logo upload.");
    }

    const upload = (await uploadResponse.json()) as LogoUpload;
    const r2Response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": upload.contentType,
      },
      body: nextLogo.blob,
    }).catch(() => null);

    if (!r2Response?.ok) {
      throw new Error("Could not upload your company logo.");
    }

    return upload.key;
  }

  async function onSubmit(values: CompanyProfileFormValues) {
    if (!organization || !isAdmin) {
      toast.error("Only organization admins can update company settings.");
      return;
    }

    try {
      const accessToken = await getAccessTokenSilently();
      const nextSlug = slugify(values.slug);
      const logoUrl = logo
        ? await uploadLogo(accessToken, organization.id, logo)
        : undefined;

      const response = await fetch(`${apiBaseUrl}/api/v1/organization/update`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: organization.id,
          name: values.name.trim(),
          slug: nextSlug,
          ...(logoUrl ? { logoUrl } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not update company profile.");
      }

      const updated = (await response.json()) as OrganizationResponse;
      toast.success("Company profile updated.");

      if (logo?.previewUrl) {
        URL.revokeObjectURL(logo.previewUrl);
        setLogo(null);
      }

      if (updated.slug !== organization.slug) {
        navigate(`/${updated.slug}/settings/company-profile`, { replace: true });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update company profile.",
      );
    }
  }

  return (
    <section className="max-w-[600px] w-[600px] mx-auto">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight">
            Company profile
          </h1>
        </div>

        {!isAdmin && (
          <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Only organization admins can update company settings.
          </p>
        )}

        <form
          className="rounded-xl border bg-card text-sm"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium">Company logo</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Upload a square logo for your organization.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage
                  src={logo?.previewUrl ?? organization?.logoUrl ?? undefined}
                  alt="Company logo"
                />
                <AvatarFallback className="text-xs">Logo</AvatarFallback>
              </Avatar>
              {isAdmin && (
                <LogoUploadDialog
                  logoUrl={logo?.previewUrl ?? organization?.logoUrl ?? null}
                  onConfirm={handleLogoConfirm}
                />
              )}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-medium">Company name</p>
            <div className="w-[280px]">
              <Input
                placeholder="Acme Inc"
                disabled={!isAdmin || isSubmitting}
                {...register("name", {
                  required: "Company name is required",
                  validate: (value) =>
                    value.trim().length > 0 || "Company name is required",
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

          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-medium">Company slug</p>
            <div className="w-[280px]">
              <Input
                placeholder="acme-inc"
                disabled={!isAdmin || isSubmitting}
                {...register("slug", {
                  required: "Company slug is required",
                  validate: (value) =>
                    slugify(value).length > 0 || "Company slug is required",
                })}
              />
              {errors.slug && (
                <p className="mt-2 text-xs text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex justify-end px-5 py-4">
            <Button type="submit" size="sm" disabled={!isAdmin || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

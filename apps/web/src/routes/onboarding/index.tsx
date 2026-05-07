import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LogoUploadDialog } from "@/components/logo-upload-dialog";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type OnboardingFormValues = {
  companyName: string;
};

type OrganizationResponse = {
  id: string;
  logoUrl: string | null;
};

type LogoUpload = {
  key: string;
  uploadUrl: string;
  contentType: string;
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function OnboardingRoute() {
  const { getAccessTokenSilently, user } = useAuth0();
  const navigate = useNavigate();
  const [logo, setLogo] = useState<{ blob: Blob; previewUrl: string } | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    defaultValues: {
      companyName: "",
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

  async function onSubmit(values: OnboardingFormValues) {
    setSubmitError(null);
    const accessToken = await getAccessTokenSilently();
    const response = await fetch(`${apiBaseUrl}/api/v1/organization/create`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: values.companyName,
        slug: slugify(values.companyName),
        userEmail: user?.email,
        userName: user?.name,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setSubmitError(
        body?.error ?? "Could not create your organization. Please try again.",
      );
      return;
    }

    const organization = (await response.json()) as OrganizationResponse;

    if (logo) {
      const uploadResponse = await fetch(
        `${apiBaseUrl}/api/v1/organization/${organization.id}/logo/upload-url`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!uploadResponse.ok) {
        const body = await uploadResponse.json().catch(() => null);
        setSubmitError(body?.error ?? "Could not prepare logo upload.");
        return;
      }

      const upload = (await uploadResponse.json()) as LogoUpload;
      const r2Response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": upload.contentType,
        },
        body: logo.blob,
      }).catch(() => null);

      if (!r2Response?.ok) {
        setSubmitError("Could not upload your organization logo.");
        return;
      }

      const updateResponse = await fetch(
        `${apiBaseUrl}/api/v1/organization/update`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            id: organization.id,
            logoUrl: upload.key,
          }),
        },
      );

      if (!updateResponse.ok) {
        const body = await updateResponse.json().catch(() => null);
        setSubmitError(body?.error ?? "Could not save your organization logo.");
        return;
      }
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <section className="h-screen flex flex-col items-center justify-center p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome to Cron 👋
      </h1>
      <form
        className="mt-8 w-full flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Field>
          <FieldLabel>Company logo</FieldLabel>
          <div className="flex items-center gap-3">
            <Avatar className="size-16">
              <AvatarImage src={logo?.previewUrl} alt="Company logo" />
              <AvatarFallback className="text-xs">Logo</AvatarFallback>
            </Avatar>
            <LogoUploadDialog
              logoUrl={logo?.previewUrl ?? null}
              onConfirm={handleLogoConfirm}
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="companyName">Company name</FieldLabel>
          <Input
            id="companyName"
            placeholder="Acme Inc"
            {...register("companyName", {
              required: "Company name is required",
            })}
          />
          {errors.companyName && (
            <p className="text-sm text-destructive">
              {errors.companyName.message}
            </p>
          )}
        </Field>
        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}
        <Button className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating organization..." : "Continue"}
        </Button>
      </form>
    </section>
  );
}

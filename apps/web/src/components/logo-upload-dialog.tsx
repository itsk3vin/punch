import { useRef, useState } from "react";
import { IconUpload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const OUTPUT_SIZE = 256;

function cropToCanvas(src: string, zoom: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));

      // Match the preview: the image covers a square box, then zoom scales it
      // from the center.
      const scale =
        Math.max(
          OUTPUT_SIZE / img.naturalWidth,
          OUTPUT_SIZE / img.naturalHeight,
        ) * zoom;
      const sourceW = OUTPUT_SIZE / scale;
      const sourceH = OUTPUT_SIZE / scale;
      const sourceX = (img.naturalWidth - sourceW) / 2;
      const sourceY = (img.naturalHeight - sourceH) / 2;

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        0,
        0, // dest x, y
        OUTPUT_SIZE,
        OUTPUT_SIZE, // dest size
      );

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("canvas toBlob failed"));
        resolve(blob);
      }, "image/png");
    };
    img.onerror = reject;
    img.src = src;
  });
}

interface LogoUploadDialogProps {
  logoUrl: string | null;
  onConfirm: (logo: { blob: Blob; previewUrl: string }) => void;
}

export function LogoUploadDialog({
  logoUrl,
  onConfirm,
}: LogoUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUrl(URL.createObjectURL(file));
    setZoom(1);
    // reset so the same file can be re-selected
    e.target.value = "";
  }

  async function handleConfirm() {
    if (!pendingUrl) return;
    setSaving(true);
    try {
      const blob = await cropToCanvas(pendingUrl, zoom);
      onConfirm({
        blob,
        previewUrl: URL.createObjectURL(blob),
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // seed dialog preview with whatever is already confirmed
      setPendingUrl(logoUrl);
      setZoom(1);
    }
  }

  const preview = pendingUrl ?? logoUrl;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Upload
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Company logo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          {/* Preview */}
          <div className="size-32 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
            {preview ? (
              <img
                src={preview}
                alt="Logo preview"
                className="h-full w-full object-cover"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center",
                }}
              />
            ) : (
              <span className="text-xs text-muted-foreground">No image</span>
            )}
          </div>

          {/* Zoom slider — only shown when there's an image */}
          {preview && (
            <div className="w-full flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground text-center">
                Zoom
              </span>
              <Slider
                min={1}
                max={3}
                step={0.01}
                value={[zoom]}
                onValueChange={([v]) => setZoom(v ?? 1)}
              />
            </div>
          )}

          {/* Upload from computer */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload className="size-4" />
            {preview ? "Upload new photo" : "Upload from computer"}
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!pendingUrl || saving}
            onClick={handleConfirm}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let detector: BarcodeDetector | null = null;
    let frameId = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ("BarcodeDetector" in window) {
          detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
          const tick = async () => {
            if (!videoRef.current || !detector) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes[0]?.rawValue) {
                onScan(codes[0].rawValue);
                navigator.vibrate?.(100);
              }
            } catch {
              // frame skip
            }
            frameId = requestAnimationFrame(tick);
          };
          frameId = requestAnimationFrame(tick);
        }
      } catch (err) {
        setError((err as Error).message);
        setActive(false);
      }
    }

    start();

    return () => {
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onScan]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={active ? "destructive" : "outline"}
        className="w-full"
        onClick={() => {
          setError(null);
          setActive((v) => !v);
        }}
      >
        {active ? <CameraOff className="mr-2 size-4" /> : <Camera className="mr-2 size-4" />}
        {active ? "Parar câmera" : "Ler código de barras"}
      </Button>
      {active && (
        <video
          ref={videoRef}
          className="aspect-video w-full rounded-xl border border-border object-cover"
          playsInline
          muted
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

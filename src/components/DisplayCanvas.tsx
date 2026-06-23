import { useEffect, useRef } from "react";
import type { DecodedFrame } from "../lib/playback";

interface DisplayCanvasProps {
  frame: DecodedFrame | null;
  isPlaying: boolean;
}

export function DisplayCanvas({ frame, isPlaying }: DisplayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    if (!frame) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const { image } = frame;
    if (canvas.width !== image.naturalWidth || canvas.height !== image.naturalHeight) {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  }, [frame]);

  return (
    <div className={`display-shell ${isPlaying ? "is-playing" : ""}`}>
      <canvas ref={canvasRef} className="display-canvas" />
    </div>
  );
}

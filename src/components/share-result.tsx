"use client";

import { Download } from "lucide-react";
import { RosicaMark } from "./logo";

export type ShareResultData = {
  group: string;
  competition: string;
  title?: string;
  sideA: string;
  sideB: string;
  scoreA: string;
  scoreB: string;
  result: string;
  date: string;
};

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  weight = 800
) {
  let size = start;
  do {
    context.font = `${weight} ${size}px system-ui, sans-serif`;
    size -= 2;
  } while (size > 28 && context.measureText(text).width > maxWidth);
}

export function ShareResult({ data }: { data: ShareResultData }) {
  function download() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#18211c";
    context.fillRect(0, 0, 1080, 1350);
    context.fillStyle = "#0b6b57";
    context.fillRect(0, 0, 1080, 24);
    context.textAlign = "left";
    context.fillStyle = "#ffffff";
    context.font = "800 48px system-ui, sans-serif";
    context.fillText("rosica", 82, 112);
    context.textAlign = "right";
    context.fillStyle = "#bfc7c1";
    context.font = "600 28px system-ui, sans-serif";
    context.fillText(data.group, 998, 105);
    context.textAlign = "center";
    context.fillStyle = "#f2b632";
    context.font = "800 25px system-ui, sans-serif";
    context.fillText(data.competition.toUpperCase(), 540, 360);
    context.fillStyle = "#ffffff";
    fitText(context, data.title ?? "FINAL RESULT", 850, 54);
    context.fillText(data.title ?? "FINAL RESULT", 540, 435);
    context.fillStyle = "#f2b632";
    context.font = "850 210px system-ui, sans-serif";
    context.textAlign = "right";
    context.fillText(data.scoreA, 475, 730);
    context.fillStyle = "#758078";
    context.textAlign = "center";
    context.fillText(":", 540, 730);
    context.fillStyle = "#f2b632";
    context.textAlign = "left";
    context.fillText(data.scoreB, 605, 730);
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    fitText(context, data.sideA, 390, 44);
    context.fillText(data.sideA, 285, 835);
    fitText(context, data.sideB, 390, 44);
    context.fillText(data.sideB, 795, 835);
    context.strokeStyle = "#3b443e";
    context.beginPath();
    context.moveTo(82, 1050);
    context.lineTo(998, 1050);
    context.stroke();
    context.fillStyle = "#f2b632";
    context.font = "800 34px system-ui, sans-serif";
    context.fillText(data.result, 540, 1130);
    context.fillStyle = "#9ca69f";
    context.font = "600 25px system-ui, sans-serif";
    context.fillText(data.date, 540, 1220);
    const anchor = document.createElement("a");
    anchor.download = `rosica-result-${Date.now()}.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }

  return (
    <div className="share-layout">
      <div className="share-preview-wrap">
        <div className="share-preview">
          <div className="share-brand">
            <RosicaMark className="logo-mark" />
            <span>{data.group}</span>
          </div>
          <div className="share-main">
            <span>{data.competition}</span>
            <h2>{data.title ?? "Final result"}</h2>
            <div className="share-score">
              <strong>{data.scoreA}</strong>
              <i>:</i>
              <strong>{data.scoreB}</strong>
            </div>
            <div className="share-names">
              <span>{data.sideA}</span>
              <span>{data.sideB}</span>
            </div>
          </div>
          <div className="share-result">{data.result}</div>
        </div>
      </div>
      <aside className="surface surface-pad">
        <p className="eyebrow">Image preview</p>
        <h2>Ready to share</h2>
        <p>
          Downloads as a polished 1080 x 1350 PNG, ideal for messaging and
          social feeds.
        </p>
        <button
          className="button button-primary"
          type="button"
          onClick={download}
        >
          <Download size={18} /> Download PNG
        </button>
        <p style={{ fontSize: ".78rem", marginTop: 18 }}>
          No result data is sent to a social network. You choose where to share
          the downloaded file.
        </p>
      </aside>
    </div>
  );
}

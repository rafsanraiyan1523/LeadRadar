import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#3355d8",
        borderRadius: 7,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <circle cx="14" cy="16" r="11" stroke="#fafbff" strokeWidth="2.4" opacity="0.4" />
        <circle cx="14" cy="16" r="6.5" stroke="#fafbff" strokeWidth="2.4" opacity="0.7" />
        <circle cx="14" cy="16" r="2" fill="#fafbff" />
        <path d="M14 16L23 8" stroke="#fafbff" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="7" r="3.2" fill="#fafbff" />
      </svg>
    </div>,
    { ...size },
  );
}

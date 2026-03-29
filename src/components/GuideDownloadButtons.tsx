import React, { useState } from "react";

interface Props {
  role: "player" | "instructor";
}

export function GuideDownloadButtons({ role }: Props) {
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [loadingInstructor, setLoadingInstructor] = useState(false);

  async function handlePlayerGuide() {
    setLoadingPlayer(true);
    try {
      const { downloadPlayerGuide } = await import("../guides/downloadGuide");
      await downloadPlayerGuide();
    } catch (e) {
      console.error("Failed to generate Player Guide PDF:", e);
    } finally {
      setLoadingPlayer(false);
    }
  }

  async function handleInstructorGuide() {
    setLoadingInstructor(true);
    try {
      const { downloadInstructorGuide } = await import(
        "../guides/downloadGuide"
      );
      await downloadInstructorGuide();
    } catch (e) {
      console.error("Failed to generate Instructor Guide PDF:", e);
    } finally {
      setLoadingInstructor(false);
    }
  }

  return (
    <div className="guide-buttons">
      <button
        className="btn secondary"
        onClick={handlePlayerGuide}
        disabled={loadingPlayer}
      >
        {loadingPlayer ? (
          <>
            <span className="spinner" /> Generating…
          </>
        ) : (
          <>
            <DownloadIcon /> Player's Guide
          </>
        )}
      </button>
      {role === "instructor" && (
        <button
          className="btn secondary"
          onClick={handleInstructorGuide}
          disabled={loadingInstructor}
        >
          {loadingInstructor ? (
            <>
              <span className="spinner" /> Generating…
            </>
          ) : (
            <>
              <DownloadIcon /> Instructor's Guide
            </>
          )}
        </button>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 6, verticalAlign: "middle" }}
    >
      <path d="M8 2v8M4 7l4 4 4-4M2 13h12" />
    </svg>
  );
}

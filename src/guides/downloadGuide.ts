import React from "react";

export async function downloadPlayerGuide() {
  const [{ pdf }, { PlayerGuide }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./PlayerGuide"),
  ]);
  const blob = await pdf(React.createElement(PlayerGuide)).toBlob();
  triggerDownload(blob, "Croissant-Lab-Players-Guide.pdf");
}

export async function downloadInstructorGuide() {
  const [{ pdf }, { InstructorGuide }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./InstructorGuide"),
  ]);
  const blob = await pdf(React.createElement(InstructorGuide)).toBlob();
  triggerDownload(blob, "Croissant-Lab-Instructors-Guide.pdf");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

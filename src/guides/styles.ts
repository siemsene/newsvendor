import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  accent: "#f7a033",
  accentLight: "#fff5e6",
  dark: "#0d1117",
  darkCard: "#161b22",
  text: "#333333",
  textLight: "#666666",
  white: "#ffffff",
  border: "#e0e0e0",
  success: "#3fb950",
  danger: "#f85149",
};

export const s = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: colors.text,
    lineHeight: 1.5,
  },
  /* ─── Header bar (top of every page) ─── */
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: colors.dark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 48,
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 9,
    color: "#8b949e",
    marginLeft: 8,
  },
  /* ─── Footer ─── */
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: colors.textLight,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.textLight,
  },
  /* ─── Cover page ─── */
  coverPage: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  coverBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dark,
  },
  coverTitle: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 18,
    color: colors.white,
    marginBottom: 4,
  },
  coverTagline: {
    fontSize: 12,
    color: "#8b949e",
    marginTop: 16,
  },
  /* ─── Typography ─── */
  h1: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 12,
  },
  h2: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 8,
    marginTop: 16,
  },
  h3: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 6,
    marginTop: 12,
  },
  body: {
    fontSize: 11,
    marginBottom: 8,
    lineHeight: 1.6,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  mono: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#f4f4f4",
    padding: 2,
  },
  /* ─── Bullets ─── */
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 14,
    fontSize: 11,
    color: colors.accent,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.5,
  },
  /* ─── Numbered list ─── */
  numRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 8,
  },
  numLabel: {
    width: 20,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
  },
  numText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.5,
  },
  /* ─── Section divider ─── */
  sectionRule: {
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: 10,
    borderRadius: 1,
  },
  /* ─── Table ─── */
  table: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.dark,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#f9f9f9",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
  },
  /* ─── Tip box ─── */
  tipBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentLight,
    padding: 10,
    marginVertical: 8,
    borderRadius: 4,
  },
  tipLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.text,
  },
  /* ─── Formula box ─── */
  formulaBox: {
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 10,
    marginVertical: 8,
    alignItems: "center",
  },
  formulaText: {
    fontFamily: "Courier",
    fontSize: 11,
    color: colors.dark,
  },
});

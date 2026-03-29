import React from "react";
import { Page, View, Text } from "@react-pdf/renderer";
import { s } from "../styles";

interface Props {
  guideName: string;
  children: React.ReactNode;
}

export function GuidePage({ guideName, children }: Props) {
  return (
    <Page size="LETTER" style={s.page}>
      {/* Header bar */}
      <View style={s.headerBar} fixed>
        <Text style={s.headerTitle}>Croissant Lab</Text>
        <Text style={s.headerSub}>{guideName}</Text>
      </View>

      {/* Page content */}
      {children}

      {/* Footer */}
      <View style={s.footer} fixed>
        <Text style={s.footerText}>Croissant Lab — {guideName}</Text>
        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

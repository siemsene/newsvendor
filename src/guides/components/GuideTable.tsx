import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";

interface Props {
  headers: string[];
  rows: string[][];
}

export function GuideTable({ headers, rows }: Props) {
  return (
    <View style={s.table}>
      <View style={s.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text key={i} style={s.tableHeaderCell}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={ri % 2 === 1 ? s.tableRowAlt : s.tableRow}>
          {row.map((cell, ci) => (
            <Text key={ci} style={s.tableCell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

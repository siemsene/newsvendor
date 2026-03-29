import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { s } from "../styles";

interface Props {
  children: string;
  label?: string;
}

export function GuideTip({ children, label = "Tip" }: Props) {
  return (
    <View style={s.tipBox}>
      <Text style={s.tipLabel}>{label}</Text>
      <Text style={s.tipText}>{children}</Text>
    </View>
  );
}
